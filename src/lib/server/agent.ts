import { BskyAgent } from '@atproto/api';
import { ATP_PDS_URL } from './env';

export const createAgent = (): BskyAgent => new BskyAgent({ service: ATP_PDS_URL });
