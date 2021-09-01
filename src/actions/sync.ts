import chalk from "chalk";
import { execSync } from "child_process";
import prompts from "prompts";
import {
  ExitFailedError,
  KilledError,
  PreconditionsFailedError,
} from "../lib/errors";
import { currentBranchPrecondition } from "../lib/preconditions";
import {
  checkoutBranch,
  getTrunk,
  gpExecSync,
  logInfo,
  uncommittedChanges,
} from "../lib/utils";
import Branch from "../wrapper-classes/branch";
import { ontoAction } from "./onto";

export async function syncAction(opts: {
  pull: boolean;
  force: boolean;
}): Promise<void> {
  if (uncommittedChanges()) {
    throw new PreconditionsFailedError("Cannot sync with uncommitted changes");
  }
  const oldBranch = currentBranchPrecondition();
  const trunk = getTrunk().name;
  checkoutBranch(trunk);

  if (opts.pull) {
    gpExecSync({ command: `git pull` }, (err) => {
      checkoutBranch(oldBranch.name);
      throw new ExitFailedError(`Failed to pull trunk ${trunk}`, err);
    });
  }

  await deleteMergedBranches(opts.force);
  if (Branch.exists(oldBranch.name)) {
    checkoutBranch(oldBranch.name);
  } else {
    checkoutBranch(trunk);
  }
}

async function deleteMergedBranches(force: boolean): Promise<void> {
  const trunkChildren: Branch[] = getTrunk().getChildrenFromMeta();
  do {
    const branch = trunkChildren.pop();
    if (!branch) {
      break;
    }
    const children = branch.getChildrenFromMeta();
    if (!shouldDeleteBranch(branch.name)) {
      continue;
    }
    for (const child of children) {
      checkoutBranch(child.name);
      logInfo(`upstacking (${child.name}) onto (${getTrunk().name})`);
      await ontoAction(getTrunk().name);
      trunkChildren.push(child);
    }
    checkoutBranch(getTrunk().name);
    await deleteBranch({ branchName: branch.name, force });
  } while (trunkChildren.length > 0);
}

function shouldDeleteBranch(branchName: string): boolean {
  const trunk = getTrunk().name;
  const cherryCheckProvesMerged = execSync(
    `mergeBase=$(git merge-base ${trunk} ${branchName}) && git cherry ${trunk} $(git commit-tree $(git rev-parse "${branchName}^{tree}") -p $mergeBase -m _)`
  )
    .toString()
    .trim()
    .startsWith("-");
  if (cherryCheckProvesMerged) {
    return true;
  }
  const diffCheckProvesMerged =
    execSync(`git diff ${branchName} ${trunk} | wc -l`).toString().trim() ===
    "0";
  if (diffCheckProvesMerged) {
    return true;
  }
  return false;
}

async function deleteBranch(opts: { branchName: string; force: boolean }) {
  if (!opts.force) {
    const response = await prompts(
      {
        type: "confirm",
        name: "value",
        message: `Delete (${chalk.green(
          opts.branchName
        )}), which has been merged into (${getTrunk().name})?`,
        initial: true,
      },
      {
        onCancel: () => {
          throw new KilledError();
        },
      }
    );
    if (response.value != true) {
      return;
    }
  }
  logInfo(`Deleting (${chalk.red(opts.branchName)})`);
  execSync(`git branch -D ${opts.branchName}`);
}