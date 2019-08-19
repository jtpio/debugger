// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { expect } from 'chai';

import { ClientSession, IClientSession } from '@jupyterlab/apputils';

import { createClientSession } from '@jupyterlab/testutils';

import { DebugProtocol } from 'vscode-debugprotocol';

import { IDebugger } from '../../lib/tokens';
import { DebugSession } from '../../lib/session';

describe('DebugSession', () => {
  let client: IClientSession;

  beforeEach(async () => {
    client = await createClientSession({
      kernelPreference: {
        name: 'xpython'
      }
    });
    await (client as ClientSession).initialize();
    await client.kernel.ready;
  });

  afterEach(async () => {
    await client.shutdown();
  });

  describe('#isDisposed', () => {
    it('should return whether the object is disposed', () => {
      const debugSession = new DebugSession({ client });
      expect(debugSession.isDisposed).to.equal(false);
      debugSession.dispose();
      expect(debugSession.isDisposed).to.equal(true);
    });
  });

  describe('#eventMessage', () => {
    it('should be emitted when sending debug messages', async () => {
      const debugSession = new DebugSession({ client });
      let events: string[] = [];
      debugSession.eventMessage.connect((sender, event) => {
        events.push(event.event);
      });
      await debugSession.start();
      await debugSession.stop();
      expect(events).to.deep.equal(['output', 'initialized', 'process']);
    });
  });

  describe('#sendRequest', () => {
    let debugSession: DebugSession;

    beforeEach(async () => {
      debugSession = new DebugSession({ client });
      await debugSession.start();
    });

    afterEach(async () => {
      await debugSession.stop();
      debugSession.dispose();
    });

    it('should send debug messages to the kernel', async () => {
      const code = 'i=0\ni+=1\ni+=1';
      const reply = await debugSession.sendRequest('updateCell', {
        cellId: 0,
        nextId: 1,
        code
      });
      expect(reply.body.sourcePath).to.contain('.py');
    });

    it('should handle replies with success false', async () => {
      const reply = await debugSession.sendRequest('evaluate', {
        expression: 'a'
      });
      const { success, message } = reply;
      expect(success).to.be.false;
      expect(message).to.contain('Unable to find thread for evaluation');
    });
  });
});

describe('protocol', () => {
  const code = [
    'i = 0',
    'i += 1',
    'i += 1',
    'j = i**2',
    'j += 1',
    'print(i, j)'
  ].join('\n');

  const breakpoints: DebugProtocol.SourceBreakpoint[] = [
    { line: 3 },
    { line: 5 }
  ];

  let client: IClientSession;
  let debugSession: DebugSession;
  let threadId: number = 1;

  beforeEach(async () => {
    client = await createClientSession({
      kernelPreference: {
        name: 'xpython'
      }
    });
    await (client as ClientSession).initialize();
    await client.kernel.ready;
    debugSession = new DebugSession({ client });
    await debugSession.start();

    debugSession.eventMessage.connect(
      (sender: DebugSession, event: IDebugger.ISession.Event) => {
        const eventName = event.event;
        if (eventName === 'thread') {
          const msg = event as DebugProtocol.ThreadEvent;
          threadId = msg.body.threadId;
        }
      }
    );

    const reply = await debugSession.sendRequest('updateCell', {
      cellId: 0,
      nextId: 1,
      code
    });
    await debugSession.sendRequest('setBreakpoints', {
      breakpoints,
      source: { path: reply.body.sourcePath },
      sourceModified: false
    });
    await debugSession.sendRequest('configurationDone', {});
    debugSession.execute(code);
    debugSession.execute(code);
    debugSession.execute(code);
  });

  afterEach(async () => {
    await debugSession.stop();
    debugSession.dispose();
    await client.shutdown();
    client.dispose();
  });

  describe('#stackTrace', () => {
    it('should return the correct stackframes', async () => {
      const reply = await debugSession.sendRequest('stackTrace', {
        threadId
      });
      expect(reply.success).to.be.true;
    });
  });
});
