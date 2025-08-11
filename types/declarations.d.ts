import { SteamProfile, SteamProviderOptions } from '../src/types/steam';
import { OAuthConfig } from 'next-auth/providers';
declare module 'authjs-steam-provider' {
  export default function SteamProvider(req: Request, options: SteamProviderOptions): OAuthConfig<SteamProfile>;
}