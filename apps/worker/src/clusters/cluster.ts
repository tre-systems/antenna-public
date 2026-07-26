// Grouping of recurring problem posts. A single post is noise; the demand
// signal is the same problem showing up repeatedly from different people, so
// clusters are ranked by how many *distinct* posts they cover — never by a
// model's opinion of how good the problem is. Embeddings supply similarity
// only, which keeps every rank explainable from the posts behind it.

export type ProblemInput = {
  readonly postId: string;
  readonly subreddit: string;
  readonly title: string;
  readonly body: string;
  readonly permalink: string;
  readonly createdMs: number;
};

export type EmbeddedProblem = ProblemInput & { readonly embedding: readonly number[] };

export type ProblemCluster = {
  readonly key: string;
  readonly label: string;
  readonly members: readonly EmbeddedProblem[];
  readonly distinctPosts: number;
  readonly subreddits: readonly string[];
  readonly firstSeenMs: number;
  readonly lastSeenMs: number;
};

export type ClusterOptions = {
  readonly threshold?: number;
  readonly minMembers?: number;
};

type OpenCluster = { members: EmbeddedProblem[]; centroid: number[] };

const DEFAULT_THRESHOLD = 0.82;
const DEFAULT_MIN_MEMBERS = 2;
const STATEMENT_MAX_CHARS = 500;

// Each archive snapshot re-reports every post still inside the lookback window,
// so without this one post refreshed four times a day for a week would look like
// 28 people with the same problem.
export const dedupeByPost = (items: readonly ProblemInput[]): ProblemInput[] => {
  const byId = new Map<string, ProblemInput>();
  for (const item of items) {
    const seen = byId.get(item.postId);
    if (!seen || item.createdMs < seen.createdMs) byId.set(item.postId, item);
  }
  return [...byId.values()].sort(
    (a, b) => a.createdMs - b.createdMs || a.postId.localeCompare(b.postId),
  );
};

// Beyond a few hundred characters a post is mostly context and dilutes the
// vector, so the body is trimmed rather than embedded whole.
export const problemStatement = (item: ProblemInput): string =>
  `${item.title}\n${item.body}`.replace(/\s+/g, ' ').trim().slice(0, STATEMENT_MAX_CHARS);

export const cosineSimilarity = (a: readonly number[], b: readonly number[]): number => {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Greedy single-pass agglomeration against cluster centroids. Chosen over a
// proper hierarchical clustering because it is O(n·k), runs inside a Worker
// invocation, and is deterministic given a deterministic input order.
export const clusterProblems = (
  items: readonly EmbeddedProblem[],
  options: ClusterOptions = {},
): ProblemCluster[] => {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const minMembers = options.minMembers ?? DEFAULT_MIN_MEMBERS;

  const ordered = [...items].sort(
    (a, b) => a.createdMs - b.createdMs || a.postId.localeCompare(b.postId),
  );

  const open: OpenCluster[] = [];
  for (const item of ordered) {
    const best = bestMatch(open, item.embedding, threshold);
    if (best === undefined) {
      open.push({ members: [item], centroid: [...item.embedding] });
      continue;
    }
    best.members.push(item);
    best.centroid = recentre(best.centroid, item.embedding, best.members.length);
  }

  return open
    .map(({ members }) => toCluster(members))
    .filter((cluster) => cluster.distinctPosts >= minMembers)
    .sort(
      (a, b) =>
        b.distinctPosts - a.distinctPosts ||
        b.lastSeenMs - a.lastSeenMs ||
        a.key.localeCompare(b.key),
    );
};

const bestMatch = (
  open: readonly OpenCluster[],
  embedding: readonly number[],
  threshold: number,
): OpenCluster | undefined => {
  let winner: OpenCluster | undefined;
  let bestScore = threshold;
  for (const candidate of open) {
    const score = cosineSimilarity(candidate.centroid, embedding);
    if (score >= bestScore) {
      bestScore = score;
      winner = candidate;
    }
  }
  return winner;
};

// Running mean, so a cluster's centre reflects every member rather than drifting
// toward whichever post happened to arrive last.
const recentre = (
  centroid: readonly number[],
  addition: readonly number[],
  size: number,
): number[] => centroid.map((value, i) => value + ((addition[i] ?? 0) - value) / size);

const toCluster = (members: readonly EmbeddedProblem[]): ProblemCluster => {
  const seed = members[0];
  const times = members.map((member) => member.createdMs);
  return {
    key: seed?.postId ?? '',
    label: seed?.title ?? '',
    members,
    distinctPosts: new Set(members.map((member) => member.postId)).size,
    subreddits: [...new Set(members.map((member) => member.subreddit))].sort(),
    firstSeenMs: Math.min(...times),
    lastSeenMs: Math.max(...times),
  };
};
