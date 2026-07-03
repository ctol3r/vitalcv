/**
 * Registers the extensionless-TS resolve hook (`ts-resolver.mjs`) for the
 * release-verify runner. Passed to Node via `--import` in the `verify:release`
 * package script so `pnpm verify:release` needs no special flags at the call
 * site. The hook module runs on a separate thread, hence the register()
 * indirection (a loader cannot both register itself and be the hook).
 */
import { register } from 'node:module';

register('./ts-resolver.mjs', import.meta.url);
