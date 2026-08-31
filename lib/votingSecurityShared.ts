export type VotingSecurityLevel = 'info' | 'warning' | 'high';
export type VotingSecurityKind = 'ip_cluster' | 'domain_cluster' | 'time_cluster';

export type VotingSecurityParticipant = {
  voteId: string;
  name: string;
  email: string;
  createdAt: string;
  verifiedAt: string | null;
  isExcluded: boolean;
};

export type VotingSecurityAlert = {
  id: string;
  kind: VotingSecurityKind;
  level: VotingSecurityLevel;
  title: string;
  description: string;
  targetSongId: string | null;
  targetSong: string | null;
  voteCount: number;
  countedVoteIds: string[];
  excludedVoteIds: string[];
  allVoteIds: string[];
  selectionPct: number | null;
  averagePoints: number | null;
  baselineAveragePoints: number | null;
  pointsLift: number | null;
  domain: string | null;
  ipGroup: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  participants: VotingSecurityParticipant[];
};

export type VotingSecurityReport = {
  roundId: string;
  trackingConfigured: boolean;
  ipColumnAvailable: boolean;
  verifiedVotes: number;
  countedVotes: number;
  trackedVerifiedVotes: number;
  activeAlerts: VotingSecurityAlert[];
  resolvedAlerts: VotingSecurityAlert[];
  errors: string[];
};
