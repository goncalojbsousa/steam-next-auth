import type { SteamProviderOptions, SteamProfile } from './steam'
import type { OAuthConfig } from 'next-auth/providers'

declare function SteamProvider(req: Request, options: SteamProviderOptions): OAuthConfig<SteamProfile>
export default SteamProvider;