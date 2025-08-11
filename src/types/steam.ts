/**
 * Shared Steam types used by the provider.
 *
 * These mirror the response from `GetPlayerSummaries` and the options required by
 * the Auth.js provider factory.
 */
import type { OAuthUserConfig } from 'next-auth/providers';

/** Visibility of a user's Steam community profile. */
export enum CommunityVisibilityState {
  Private = 1,
  Public = 3
}

/** A user's current persona (presence) state. */
export enum PersonaState {
  Offline = 0,
  Online = 1,
  Busy = 2,
  Away = 3,
  Snooze = 4,
  LookingToTrade = 5,
  LookingToPlay = 6
}

/**
 * Subset of Steam player summary used by this package.
 * See: https://developer.valvesoftware.com/wiki/Steam_Web_API#GetPlayerSummaries
 */
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
  /**
   * The ID of the user's primary clan.
   */
  primaryclanid: string;
  /**
   * The timestamp of the user's account creation.
   */
  timecreated: number;
  /**
   * The user's persona state flags.
   */
  personastateflags: number;
  /**
   * Whether the user allows comments on their profile.
   */
  commentpermission: boolean;
}

/**
 * Options required to configure the Steam provider.
 */
export interface SteamProviderOptions extends Partial<OAuthUserConfig<SteamProfile>> {
  /**
   * The URL that the user will be redirected to after authorization.
   * @example 'https://example.com/api/auth/callback'
   */
  callbackUrl: string | URL;
  /**
   * The client secret used to authenticate with Steam.
   * @example 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
   */
  clientSecret: string;
}