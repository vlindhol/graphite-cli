import { gpExecSync } from '.';
import { ExitFailedError } from '../errors';

function doChangesExist(cmd: string): boolean {
  return (
    gpExecSync(
      {
        command: cmd,
      },
      () => {
        throw new ExitFailedError(
          `Failed to check current dir for untracked/uncommitted changes.`
        );
      }
    )
      .toString()
      .trim() !== '0'
  );
}

export function uncommittedChanges(): boolean {
  return doChangesExist(`git status -u --porcelain=v1 2>/dev/null | wc -l`); // Includes untracked and staged changes
}

export function unstagedChanges(): boolean {
  return doChangesExist(`git ls-files --others --exclude-standard | wc -l`); // untracked changes only
}

export function trackedUncommittedChanges(): boolean {
  return doChangesExist(`git status -uno --porcelain=v1 2>/dev/null | wc -l`); // staged but uncommitted changes only
}
