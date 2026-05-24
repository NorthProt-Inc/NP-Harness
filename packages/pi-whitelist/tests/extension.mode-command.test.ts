import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import whitelistExtension from '../src/extension.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue('{}'),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import * as fs from 'node:fs';

describe('whitelist mode command', () => {
  let commands: Record<string, any> = {};
  let uiMock: any;
  let piMock: any;
  let ctxMock: any;

  beforeEach(() => {
    commands = {};
    uiMock = { notify: vi.fn(), setStatus: vi.fn() };
    ctxMock = { ui: uiMock, hasUI: true };
    piMock = {
      getFlag: vi.fn().mockReturnValue(undefined),
      on: vi.fn(),
      registerCommand: vi.fn().mockImplementation((name, cmd) => {
        commands[name] = cmd;
      }),
      registerShortcut: vi.fn(),
    };
    (fs.existsSync as any).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('/whitelist mode reports current mode and cycle', async () => {
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(
      expect.stringContaining('Mode: default'),
      'info'
    );
    expect(uiMock.notify).toHaveBeenCalledWith(
      expect.stringContaining('Cycle: default -> auto -> plan -> bypass -> default'),
      'info'
    );
  });

  it('/whitelist mode cycle advances the mode', async () => {
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode cycle', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith('Mode cycled: default → auto', 'info');
    expect(uiMock.setStatus).toHaveBeenCalledWith('whitelist-mode', 'mode auto', { warning: true });
  });

  it('/whitelist mode bypass sets bypassPermissions', async () => {
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode bypass', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith('Mode -> bypassPermissions', 'info');
    expect(uiMock.setStatus).toHaveBeenCalledWith('whitelist-mode', 'mode bypass', { error: true, bold: true });
  });

  it('/whitelist mode auto --save persists in user settings', async () => {
    (fs.existsSync as any).mockReturnValue(false);
    
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode auto --save', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith('mode -> auto (saved as user default)', 'info');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.pi/agent/settings.json'),
      expect.stringContaining('"defaultMode": "auto"'),
      'utf-8'
    );
  });

  it('--save not in final position is rejected', async () => {
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode --save auto', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(
      expect.stringContaining('Invalid mode command format'),
      'error'
    );
  });

  it('extra positional arguments are rejected', async () => {
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode auto extra', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(
      expect.stringContaining('Invalid mode command format'),
      'error'
    );
  });

  it('cycle with --save is explicitly rejected', async () => {
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode cycle --save', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(
      expect.stringContaining('Error: --save is not supported with cycle'),
      'error'
    );
  });

  it('/whitelist mode auto --save=true persists in user settings', async () => {
    (fs.existsSync as any).mockReturnValue(false);
    
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode auto --save=true', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith('mode -> auto (saved as user default)', 'info');
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.pi/agent/settings.json'),
      expect.stringContaining('"defaultMode": "auto"'),
      'utf-8'
    );
  });

  it('invalid mode reports usage', async () => {
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode xyz', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(
      expect.stringContaining('Invalid mode: xyz'),
      'info'
    );
  });
});
