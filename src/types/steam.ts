import type { OAuthUserConfig } from 'next-auth/providers';

export enum CommunityVisibilityState {
  Private = 1,
  Public = 3
}

export enum PersonaState {
  Offline = 0,
  Online = 1,
  Busy = 2,
  Away = 3,
  Snooze = 4,
  LookingToTrade = 5,
  LookingToPlay = 6
}

export interface SteamProfile extends Record<string, any> {
  steamid: string;
  communityvisibilitystate: CommunityVisibilityState;
  profilestate: number;
  personaname: string;
  profileurl: string;
  avatar: string;
  avatarmedium: string;
  avatarfull: string;
  avatarhash: string;
  lastlogoff: number;
  personastate: PersonaState;
  primaryclanid: string;
  timecreated: number;
  personastateflags: number;
  commentpermission: boolean;
}

export interface SteamProviderOptions extends Partial<OAuthUserConfig<SteamProfile>> {
  /** @example 'https://example.com/api/auth/callback' */
  callbackUrl: string | URL;
  /** @example 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' */
  clientSecret: string;
}