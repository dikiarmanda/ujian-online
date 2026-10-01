import type { OriginRole } from "../exam-rules";

export type OriginUser = {
  externalId: string;
  name: string;
  identity: string;
  role: OriginRole;
  groupName?: string | null;
};

export type OriginParticipant = OriginUser;

export type ParticipantPage = {
  items: OriginParticipant[];
  hasMore: boolean;
};

export interface AuthProvider {
  login(identity: string, password: string): Promise<OriginUser>;
  listParticipants(page: number, updatedSince?: string): Promise<ParticipantPage>;
}
