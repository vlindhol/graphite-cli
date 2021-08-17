"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stacksAction = void 0;
const chalk_1 = __importDefault(require("chalk"));
const prompts_1 = __importDefault(require("prompts"));
const config_1 = require("../lib/config");
const errors_1 = require("../lib/errors");
const utils_1 = require("../lib/utils");
const branch_1 = __importDefault(require("../wrapper-classes/branch"));
function stacksAction(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        const { rootBranches, precomputedChildren } = yield computeBranchLineage();
        const trunk = utils_1.getTrunk();
        const current = branch_1.default.getCurrentBranch();
        let choices = [];
        for (const branch of rootBranches) {
            choices = choices.concat(yield computeChoices(branch, precomputedChildren, trunk, current, opts.all));
        }
        if (opts.interactive) {
            yield promptBranches(choices);
        }
        else {
            choices.forEach((choice) => {
                console.log(choice.title);
            });
            return;
        }
    });
}
exports.stacksAction = stacksAction;
function computeBranchLineage() {
    return __awaiter(this, void 0, void 0, function* () {
        const precomputedChildren = {};
        const rootBranches = [];
        const visitedBranches = {};
        // Compute lineage of stacks off of trunk.
        computeLineage({
            branch: utils_1.getTrunk().useMemoizedResults(),
            children: precomputedChildren,
            rootBranches: rootBranches,
            visitedBranches: visitedBranches,
        });
        // Compute lineage of the remaining stacks in our search space - up to
        // maxStacksShowBehindTrunk whose bases were updated more recently than
        // maxDaysShownBehindTrunk.
        const branchesWithoutParents = yield branch_1.default.getAllBranchesWithoutParents({
            useMemoizedResults: true,
            maxDaysBehindTrunk: config_1.repoConfig.getMaxDaysShownBehindTrunk(),
            maxBranches: config_1.repoConfig.getMaxStacksShownBehindTrunk(),
            excludeTrunk: true,
        });
        branchesWithoutParents.forEach((branch) => {
            computeLineage({
                branch: branch,
                children: precomputedChildren,
                rootBranches: rootBranches,
                visitedBranches: visitedBranches,
            });
        });
        return { rootBranches, precomputedChildren };
    });
}
function computeLineage(args) {
    const branch = args.branch;
    const children = args.children;
    const rootBranches = args.rootBranches;
    const visitedBranches = args.visitedBranches;
    if (visitedBranches[branch.name]) {
        return;
    }
    else {
        visitedBranches[branch.name] = true;
        children[branch.name] = [];
    }
    const parent = branch.getParentFromMeta();
    if (!parent) {
        rootBranches.push({
            branch,
            status: branch.getParentsFromGit().length > 0 ? "NEEDS_REGEN" : "TRACKED",
        });
    }
    else {
        children[parent.name].push({
            branch,
            status: branch.getParentsFromGit().some((gitParent) => {
                return gitParent.name === parent.name;
            })
                ? "TRACKED"
                : "NEEDS_RESTACK",
        });
    }
    branch.getChildrenFromGit().forEach((child) => {
        computeLineage({
            branch: child,
            children: children,
            rootBranches: rootBranches,
            visitedBranches: visitedBranches,
        });
    });
}
function computeChoices(branch, precomputedChildren, trunk, current, showAll, indent = 0) {
    return __awaiter(this, void 0, void 0, function* () {
        const children = branch.branch.name in precomputedChildren
            ? precomputedChildren[branch.branch.name]
            : [];
        if (indent === 0 &&
            children.length === 0 &&
            branch.branch.name !== trunk.name &&
            !(current && branch.branch.name === current.name) &&
            !showAll) {
            return [];
        }
        let choices = [];
        choices.push({
            value: branch.branch.name,
            title: `${"  ".repeat(indent)}${chalk_1.default.gray("↳")} ${current && branch.branch.name === current.name
                ? chalk_1.default.cyan(branch.branch.name)
                : chalk_1.default.blueBright(branch.branch.name)} (${current && branch.branch.name === current.name
                ? `${chalk_1.default.cyan("current")}, `
                : ""}${indent > 0 ? `${indent} deep` : "root"}${{
                TRACKED: "",
                NEEDS_RESTACK: `, ${chalk_1.default.yellow("Behind parent branch, consider (gt stack fix --rebase)")}`,
                NEEDS_REGEN: `, ${chalk_1.default.yellow(`untracked by Graphite, consider (git checkout ... && gt stack fix --regen)`)}`,
            }[branch.status]})`,
        });
        for (const child of children) {
            choices = choices.concat(yield computeChoices(child, precomputedChildren, trunk, current, showAll, indent + 1));
        }
        return choices;
    });
}
function promptBranches(choices) {
    return __awaiter(this, void 0, void 0, function* () {
        const currentBranch = branch_1.default.getCurrentBranch();
        let currentBranchIndex = undefined;
        if (currentBranch) {
            currentBranchIndex = choices
                .map((c) => c.value)
                .indexOf(currentBranch.name);
        }
        const chosenBranch = (yield prompts_1.default(Object.assign({ type: "select", name: "branch", message: `Checkout a branch`, choices: choices }, (currentBranchIndex ? { initial: currentBranchIndex } : {})))).branch;
        if (!chosenBranch) {
            throw new errors_1.ExitCancelledError("No branch selected");
        }
        if (chosenBranch && chosenBranch !== (currentBranch === null || currentBranch === void 0 ? void 0 : currentBranch.name)) {
            utils_1.gpExecSync({ command: `git checkout ${chosenBranch}` }, (err) => {
                throw new errors_1.ExitFailedError(`Failed to checkout ${chosenBranch}: ${err}`);
            });
        }
    });
}
//# sourceMappingURL=stacks.js.map