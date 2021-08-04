"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentGitRepoPrecondition = exports.uncommittedChangesPrecondition = exports.branchExistsPrecondition = exports.currentBranchPrecondition = void 0;
const branch_1 = __importDefault(require("../../wrapper-classes/branch"));
const errors_1 = require("../errors");
const utils_1 = require("../utils");
function currentBranchPrecondition() {
    const branch = branch_1.default.getCurrentBranch();
    if (!branch) {
        throw new errors_1.PreconditionsFailedError(`Cannot find current branch. Please ensure you're running this command atop a checked-out branch.`);
    }
    return branch;
}
exports.currentBranchPrecondition = currentBranchPrecondition;
function branchExistsPrecondition(branchName) {
    if (!branch_1.default.exists(branchName)) {
        throw new errors_1.PreconditionsFailedError(`Cannot find branch named: (${branchName}).`);
    }
}
exports.branchExistsPrecondition = branchExistsPrecondition;
function uncommittedChangesPrecondition() {
    if (utils_1.uncommittedChanges()) {
        throw new errors_1.PreconditionsFailedError(`Cannot run with uncommitted changes present, please resolve and then retry.`);
    }
}
exports.uncommittedChangesPrecondition = uncommittedChangesPrecondition;
function currentGitRepoPrecondition() {
    const repoRootPath = utils_1.gpExecSync({
        command: `git rev-parse --show-toplevel`,
    }, () => {
        return Buffer.alloc(0);
    })
        .toString()
        .trim();
    if (!repoRootPath || repoRootPath.length === 0) {
        throw new errors_1.PreconditionsFailedError("No .git repository found.");
    }
    return repoRootPath;
}
exports.currentGitRepoPrecondition = currentGitRepoPrecondition;
//# sourceMappingURL=index.js.map