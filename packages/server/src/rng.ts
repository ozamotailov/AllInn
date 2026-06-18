import crypto from 'node:crypto';
import type { RandomInt } from '@allinn/shared';

/** CSPRNG-backed uniform int in [0, max) — injected into the deck shuffle. */
export const cryptoRandomInt: RandomInt = (max) => crypto.randomInt(max);
