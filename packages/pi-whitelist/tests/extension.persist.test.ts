import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import whitelistExtension from '../src/extension.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

import * as fs from 'node:fs';

describe('whitelist mode persistence', () => {
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
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const setupFiles = (globalMode?: string, projectMode?: string, localMode?: string) => {
    (fs.existsSync as any).mockImplementation((path: string) => {
      if (globalMode && path.includes('agent/settings.json')) return true;
      if (projectMode && path.includes('.pi/settings.json')) return true;
      if (localMode && path.includes('.pi/settings.local.json')) return true;
      return false;
    });

    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (globalMode && path.includes('agent/settings.json')) return JSON.stringify({ permissions: { defaultMode: globalMode } });
      if (projectMode && path.includes('.pi/settings.json')) return JSON.stringify({ permissions: { defaultMode: projectMode } });
      if (localMode && path.includes('.pi/settings.local.json')) return JSON.stringify({ permissions: { defaultMode: localMode } });
      return '{}';
    });
  };

  it('user defaultMode loads when no project/local default exists', async () => {
    setupFiles('auto', undefined, undefined);
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('status', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(expect.stringContaining('Mode: auto'), 'info');
  });

  it('project defaultMode overrides user defaultMode', async () => {
    setupFiles('auto', 'plan', undefined);
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('status', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(expect.stringContaining('Mode: plan'), 'info');
  });

  it('local defaultMode overrides project and user defaultMode', async () => {
    setupFiles('auto', 'plan', 'acceptEdits');
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('status', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(expect.stringContaining('Mode: acceptEdits'), 'info');
  });

  it('--dangerously-skip-permissions overrides all saved defaults', async () => {
    setupFiles('auto', 'plan', 'acceptEdits');
    piMock.getFlag.mockReturnValue(true);
    
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('status', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(expect.stringContaining('Mode: bypassPermissions'), 'info');
  });

  it('invalid defaultMode is safely ignored', async () => {
    // 'invalid-mode' should be ignored and fallback to 'plan'
    setupFiles('plan', 'invalid-mode', undefined);
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('status', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(expect.stringContaining('Mode: plan'), 'info');
  });

  it('malformed existing settings.json causes error rather than silent overwrite', async () => {
    (fs.existsSync as any).mockImplementation(() => true);
    (fs.readFileSync as any).mockImplementation(() => '{ malformed json }');
    
    await whitelistExtension(piMock as any);
    await commands['whitelist'].handler('mode auto --save', ctxMock);
    
    expect(uiMock.notify).toHaveBeenCalledWith(
      expect.stringContaining('failed to parse existing settings.json'),
      'error'
    );
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
