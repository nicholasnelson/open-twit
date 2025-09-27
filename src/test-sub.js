// npm i ws

import WebSocket from 'ws';

const url = 'wss://jetstream2.us-west.bsky.network/subscribe?wantedCollections=app.bsky.feed.post';
import dns from 'node:dns';
const lookup4 = (h, o, cb) => dns.lookup(h, { family: 4 }, cb);
const ws = new WebSocket(url);


ws.on('open', () => console.log('open'));
ws.on('message', (data) => console.log('msg', data.toString()));
ws.on('error', (err) => console.error('error', err.code, err.message));
ws.on('close', (code, reason) => console.log('close', code, reason?.toString()));
