#!/usr/bin/env node
/**
 * The release steps whose exit code has to mean something.
 *
 * `tag-guard` and `body-check` began life as inline `VAR=$(...)` + `if [ ... ];
 * then exit 1; fi` snippets in the release SKILL.md. Neither shape can be
 * matched by a Claude Code permission rule — an allow rule stops at a variable
 * assignment — so each one cost a permission prompt on every release. The cheap
 * alternative, printing the value and letting the model compare it, turns a hard
 * stop into a suggestion, and these are the two checks that must not be
 * skippable: tagging the wrong commit corrupts the version base of every later
 * release (see "Tag Ordering" in SKILL.md), and an empty body ships an issue or
 * release page with nothing on it.
 *
 * `branch-cleanup` is the inverse problem. `gh pr merge --delete-branch`
 * already checks out the default branch and deletes both copies of the feature
 * branch, so a bare `git branch -D` after it exits 1 with
 * `branch '<name>' not found` on every clean release — a real non-zero exit for
 * the expected outcome, which trains the reader to ignore the one case that
 * matters. Post-merge cleanup is idempotent by nature: absent is the goal, not
 * an error.
 *
 * Node builtins only, and plain `.mjs` rather than TypeScript. This runs at
 * points in the flow where `pnpm install` is not guaranteed to have happened,
 * and `svelte-check` only covers the paths in `.svelte-kit/tsconfig.json`
 * (`src/`, `vite.config.ts`, `test/`) — a `.ts` file here would look
 * type-checked and never be. `pnpm lint` and `pnpm format:check` do reach
 * `scripts/`, so this file is linted and formatted like the rest of the repo.
 *
 * Run: node scripts/release-guard.mjs tag-guard      <pr-number>
 *      node scripts/release-guard.mjs push-guard     <branch>
 *      node scripts/release-guard.mjs body-check     <issue|pr|release> <id>
 *      node scripts/release-guard.mjs branch-cleanup <branch>
 */

import { execFileSync } from 'node:child_process';

/** stderr is inherited so gh's own error text reaches the user unedited. */
function run(file, args) {
	return execFileSync(file, args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'inherit']
	}).trim();
}

/**
 * Run a command whose failure is an answer rather than a problem, and swallow
 * its stderr. Returns null on any non-zero exit.
 */
function probe(file, args) {
	try {
		return execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
	} catch {
		return null;
	}
}

/**
 * Refuse to tag unless HEAD is the squash-merge commit GitHub actually wrote.
 *
 * A successful `git pull` does not prove it. A concurrent push, or a merge
 * GitHub has not finished writing, leaves HEAD one commit off — and a tag made
 * there is not an ancestor of `main`, so `git describe` never finds it again
 * and every later release computes its version from a stale base.
 */
function tagGuard(pr) {
	const merge = run('gh', ['pr', 'view', pr, '--json', 'mergeCommit', '-q', '.mergeCommit.oid']);

	if (merge === '') {
		console.log(`tag guard FAILED: PR #${pr} has no merge commit — it is not merged yet.`);
		return false;
	}

	const head = run('git', ['rev-parse', 'HEAD']);

	if (merge !== head) {
		console.log(`tag guard FAILED: PR #${pr} merged as ${merge}, HEAD is ${head}.`);
		console.log('Do not tag. Pull main again and re-run this check.');
		return false;
	}

	console.log(`tag guard ok: HEAD is PR #${pr}'s merge commit (${head}).`);
	return true;
}

/**
 * Refuse to open a PR when GitHub's copy of the branch is not the local one.
 *
 * Step 13 pushes and then keeps working — it assembles the PR body out of the
 * plan file — so there is a window between the push and `gh pr create` in which
 * a commit can still be made. That window is not hypothetical: it is exactly
 * where you notice the plan file is stale, because building the body is when
 * you finally read it. `gh pr create` says nothing about it; it opens the PR
 * against whatever the remote branch points at, and the squash merge lands that.
 *
 * In the blog repo this guard was written for, release v0.33.1 lost a
 * documentation commit this way. The PR body was correct, since Step 13 builds
 * it from the LOCAL file, while the committed file was a version behind — so
 * `body-check` passed on a body that disagreed with the repository it shipped
 * in. Nothing else in the flow compares the two, which is why this check
 * compares SHAs instead: one commit missing is one commit that will not be
 * merged, whatever it happens to contain.
 *
 * Two things here are deliberate.
 *
 * It compares `refs/heads/<branch>`, NOT `HEAD`. `gh pr create --head <branch>`
 * ships the named branch, which is the same ref as HEAD only while that branch
 * is the one checked out. Detached, or standing somewhere else, a HEAD-based
 * check compares a ref the PR will not use and can report ok while the branch
 * carries an unpushed commit — a hole in precisely the case this exists to
 * close.
 *
 * It asks the REMOTE, not `refs/remotes/origin/<branch>`. That tracking ref is a
 * local cache refreshed only by this clone's own fetches and pushes, so a branch
 * moved from a second clone or from the GitHub UI leaves it stale and the guard
 * would compare against a SHA that no longer exists upstream.
 */
function pushGuard(branch) {
	const local = probe('git', ['rev-parse', '--verify', `refs/heads/${branch}`]);

	if (local === null) {
		console.log(`push guard FAILED: no local branch ${branch}.`);
		return false;
	}

	/*
	 * `ls-remote` distinguishes the two failures a cache cannot: empty output
	 * with a zero exit means the remote genuinely has no such branch, while a
	 * non-zero exit means the question could not be asked at all — no network,
	 * no credentials. Those want opposite advice, and neither is "carry on".
	 */
	const listing = probe('git', ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`]);

	if (listing === null) {
		console.log('push guard FAILED: could not reach origin to check the branch.');
		console.log('Fix the connection or credentials and re-run — do not open the PR unverified.');
		return false;
	}

	if (listing === '') {
		console.log(`push guard FAILED: origin has no branch ${branch} — push it before opening a PR.`);
		console.log(`Run: git push -u origin ${branch}`);
		return false;
	}

	const remote = listing.split('\t')[0];

	if (local !== remote) {
		console.log(`push guard FAILED: local ${branch} is ${local}, origin/${branch} is ${remote}.`);

		/*
		 * Name the direction. The comparison is inequality, so it fires in three
		 * states that need three different remedies, and printing the "push
		 * again" one unconditionally is advice that a non-fast-forward rejection
		 * makes useless. A guard that sends you round a loop it cannot clear is
		 * worse than one that says nothing.
		 */
		const remoteIsBehind = probe('git', ['merge-base', '--is-ancestor', remote, local]) !== null;
		const remoteIsAhead = probe('git', ['merge-base', '--is-ancestor', local, remote]) !== null;

		if (remoteIsBehind)
			console.log(
				`Commits exist locally that the PR would not contain. Run: git push origin ${branch}`
			);
		else if (remoteIsAhead)
			console.log(`origin is ahead. Run: git pull --ff-only origin ${branch}`);
		else console.log('The two have diverged. Reconcile them by hand before opening the PR.');

		return false;
	}

	console.log(`push guard ok: origin/${branch} matches local ${branch} (${local}).`);
	return true;
}

const RESOURCES = ['issue', 'pr', 'release'];

/**
 * A `gh ... create --body-file` that silently wrote nothing is the failure the
 * Safe GitHub Body Write pattern exists to catch: the issue or release still
 * gets created, so nothing downstream errors, and the empty page is only
 * noticed by a human much later.
 */
function bodyCheck(resource, id) {
	if (!RESOURCES.includes(resource)) {
		console.log(`unknown resource "${resource}" — expected ${RESOURCES.join(', ')}.`);
		return false;
	}

	const body = run('gh', [resource, 'view', id, '--json', 'body', '-q', '.body']);

	if (body.length === 0) {
		console.log(`${resource} ${id} body is EMPTY. Stop the release flow — do not continue.`);
		return false;
	}

	console.log(`${resource} ${id} body verified (${body.length} chars).`);
	return true;
}

/** Branches this must never delete, whatever it is handed. */
const PROTECTED_BRANCHES = ['main', 'master', 'HEAD'];

/**
 * Remove both copies of a merged feature branch, treating "already gone" as
 * success.
 *
 * `gh pr merge --delete-branch` normally does all of this itself, so the usual
 * outcome here is that both copies are already absent and nothing runs. The
 * step still exists for the paths that bypass gh: a merge done in the browser,
 * a merge without `--delete-branch`, or a repo whose settings re-create the
 * remote branch. Deleting nothing must exit 0, or the expected case looks like
 * a failure — the exact noise this replaced.
 */
function branchCleanup(branch) {
	if (PROTECTED_BRANCHES.includes(branch)) {
		console.log(`refusing to delete "${branch}" — that is a protected branch name.`);
		return false;
	}

	const current = run('git', ['branch', '--show-current']);

	if (current === branch) {
		console.log(`still on "${branch}" — check out main before cleaning it up.`);
		return false;
	}

	if (probe('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]) === null) {
		console.log(`local  ${branch}: already gone`);
	} else if (probe('git', ['branch', '-D', branch]) === null) {
		console.log(
			`local  ${branch}: DELETE FAILED — remove it by hand with: git branch -D ${branch}`
		);
		return false;
	} else {
		// -D, not -d: squash merge rewrites the diff onto a new commit, so git
		// does not consider the branch merged and -d would refuse.
		console.log(`local  ${branch}: deleted`);
	}

	if (probe('git', ['ls-remote', '--exit-code', '--heads', 'origin', branch]) === null) {
		console.log(`remote ${branch}: already gone`);
		return true;
	}

	if (probe('git', ['push', 'origin', '--delete', branch]) === null) {
		// Not fatal: the release has already landed and been tagged by now. A
		// stale remote branch is untidy, not broken.
		console.log(
			`remote ${branch}: DELETE FAILED — remove it by hand with: git push origin --delete ${branch}`
		);
		return true;
	}

	console.log(`remote ${branch}: deleted`);
	return true;
}

function usage() {
	console.log('usage: release-guard.mjs tag-guard      <pr-number>');
	console.log('       release-guard.mjs push-guard     <branch>');
	console.log('       release-guard.mjs body-check     <issue|pr|release> <id>');
	console.log('       release-guard.mjs branch-cleanup <branch>');
	return false;
}

function main() {
	const [command, first, second] = process.argv.slice(2);

	if (command === 'tag-guard' && first !== undefined && second === undefined)
		return tagGuard(first);
	if (command === 'push-guard' && first !== undefined && second === undefined)
		return pushGuard(first);
	if (command === 'body-check' && first !== undefined && second !== undefined)
		return bodyCheck(first, second);
	if (command === 'branch-cleanup' && first !== undefined && second === undefined)
		return branchCleanup(first);

	return usage();
}

try {
	if (!main()) process.exitCode = 1;
} catch (error) {
	console.log(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
