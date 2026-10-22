// Reuse the isolated native audit's setup and capture helpers for documentation.
// No real workspace is opened. All records are fictional; credentials stay in memory.
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const source = await readFile(new URL('./full-app-native-audit.mjs', import.meta.url), 'utf8');
const end = source.indexOf("    await check('global-search-keyboard-deep-link'");
if (end < 0) throw new Error('Documentation capture adapter needs updating');
let runner = source.slice(0, end);
runner = runner.replace(
  "import { screens } from './guide-content.mjs';",
  "import { screens as guideScreens } from './guide-content.mjs';\nconst screens = guideScreens.map((screen) => ({ ...screen, action: { ...screen.action, selector: screen.action.selector?.replace('.text-button', 'button') } }));",
);
runner = runner.replace(
  '    assert(data.callouts.length > 0, `No visible callout for ${screen.id}`);',
  '    // Documentation uses unannotated originals; source-guide callout selectors may be obsolete.',
);
runner = runner.replace(
  String.raw`await h.wait('.command-palette [role="option"]');`,
  String.raw`await h.wait('[role="option"]');`,
);
runner = runner.replace(
  '      await h.go(path);',
  "      await h.go(path);\n      await h.fill('.global-search input', '');",
);
runner = runner.replace(
  "        await h.browser.keys(['Control', 'k']);",
  "        await h.browser.setWindowSize(760, 900);\n        await h.click('.search-palette-trigger');\n        await h.browser.setWindowSize(1440, 900);",
);
runner = runner.replace(
  "if (a.submit) await h.click('form button:not([type])');",
  'if (a.submit) await h.click(\'form button[type="submit"]\');',
);
runner = runner.replace(
  'screens.filter((s) => !s.action.gate)',
  "screens.filter((s) => !s.action.gate && !['poa-inline-client','backup-validate','backup-corrupt','backup-restored','date-picker'].includes(s.id) && (!process.env.DOC_SCREEN_FILTER || new RegExp(process.env.DOC_SCREEN_FILTER).test(s.id)))",
);
runner = runner.replace("            'poa.add',\n", '');
runner = runner.replace('readFile, rename', 'readFile, rename, rm');
runner = runner.replace('      stage = screen.id;', '      try {\n      stage = screen.id;');
const loopEnd = runner.lastIndexOf('    }');
runner =
  runner.slice(0, loopEnd) +
  `      } catch (error) {
        allResults.push({ locale: language, scenario: 'screen-' + screen.id, result: 'failed', errorCode: error.code || 'SCREEN_CAPTURE_FAILED' });
        console.log(language + ': screen blocker: ' + screen.id);
        process.exitCode = 1;
      }
` +
  runner.slice(loopEnd);
const wrongPasswordStart = runner.indexOf("    stage = 'wrong-password';");
const recoveryEnd = runner.indexOf('    const today =', wrongPasswordStart);
runner =
  runner.slice(0, wrongPasswordStart) +
  `    await button('gate.haveRecoveryKey');
    await h.wait('input[name="recoveryKey"]');
    await capture(h, { id: 'recovery', kind: 'form' });
    await button('gate.backToUnlock');
    await h.fill('input[name="password"]', password);
    await button('gate.submit.unlock');
    await h.wait('.workspace');
` +
  runner.slice(recoveryEnd);
runner += String.raw`
    const extra = async (id, action, kind = 'page') => {
      stage = id;
      await action();
      await capture(h, { id, kind });
      saveResult('screen-' + id);
    };
    if (process.env.DOC_EXTRA_CONTROLS) {
      await extra('case-archive-confirm', async () => {
        await go(paths.case); await button('records.archive');
        await h.wait('[role="alertdialog"]');
      });
      for (const type of ['payment', 'expense']) {
        await extra(type + '-delete-confirm', async () => {
          await go('/finances?case=' + caseItem.id);
          if (type === 'expense') await h.tab(1);
          await h.click('tbody tr:first-child td:first-child button');
          await h.wait('[role="dialog"]');
          await button('finances.delete', '[role="dialog"]');
          await h.wait('[role="alertdialog"]');
        });
      }
      await extra('recovery-key-replaced', async () => {
        await go('/settings?tab=security');
        await h.fill('.settings-content .settings-section:last-child input[type="password"]', password);
        await button('settings.security.recoveryReplace');
        await h.wait('.recovery-key');
        await h.browser.execute(() => {
          document.querySelector('.recovery-key').textContent = '[RECOVERY KEY HIDDEN / مفتاح الاسترداد محجوب]';
        });
      });
    }
    if (!process.env.DOC_SCREEN_FILTER) {
    await extra('case-clients-edit', async () => {
      await go(paths.case); await h.tab(1);
      await button('records.edit', '.detail-card:first-child');
      await h.wait('[role="dialog"] form');
    }, 'form');
    await extra('poa-inline-client', async () => {
      await go('/powers-of-attorney/new');
      await button('cases.form.addClientLink');
      await h.wait('[role="dialog"] form');
    }, 'form');
    await extra('document-owner', async () => {
      await go('/attachments'); await button('documents.add');
      await h.wait('[role="dialog"]');
    }, 'form');
    await extra('backup-validate', async () => {
      await go('/settings?tab=backups'); await h.selection('backup');
      await button('backups.validate');
      await button('restoreFrom.chooseFile', '[role="dialog"]');
      await h.wait('[role="dialog"] [role="status"]');
    });
    await extra('backup-preview', async () => {
      await go('/settings?tab=backups'); await button('backups.restore');
      await button('restoreFrom.chooseFile', '[role="dialog"]');
      await h.wait('[role="dialog"] [role="status"]');
    });
    await extra('backup-corrupt', async () => {
      await go('/settings?tab=backups'); await h.selection('corrupt');
      await button('backups.restore');
      await button('restoreFrom.chooseFile', '[role="dialog"]');
      await h.wait('[role="dialog"] [role="alert"]');
    }, 'form');
    await h.selection('save');
    await h.invoke('backup_save_copy');
    await h.invoke('app_lock');
    await rm(join(h.root, 'vault'), { recursive: true, force: true });
    await h.restart();
    await h.wait('input[name="fullName"]');
    if (language === 'en') await h.click('.language-switcher');
    await extra('restore-password', async () => {
      await button('gate.restoreFromBackup');
      await h.wait('.restore-from-backup');
      await h.selection('portable'); await button('restoreFrom.chooseFile');
      await h.wait('.restore-from-backup form');
    }, 'form');
    await extra('restore-recovery', async () => {
      await h.click('.restore-credential-kind label:last-child input');
    }, 'form');
    }
  } catch (error) {
    // Keep driver exceptions redacted; a dead native process may also refuse screenshots.
    allResults.push({locale: language, scenario: stage, result:'failed', errorCode: error.code || 'CAPTURE_FAILED'});
    console.log(language + ': failed at ' + stage + ': ' + (error.code || error.name) + ': ' + (/^(GUIDE_|No visible callout|Recovery key)/.test(error.message) ? error.message : 'detail suppressed'));
    process.exitCode = 1;
  } finally {
    await h.close();
    await writeFile(join(output, 'capture-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
}
for (const language of (process.env.GUIDE_LANGUAGES || 'ar,en').split(',')) await run(language);
`;
const file = new URL('./.data-contract-capture-runner.mjs', import.meta.url);
try {
  await writeFile(file, runner);
  const child = spawn(process.execPath, [file.pathname], { stdio: 'inherit', env: process.env });
  process.exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await unlink(file).catch(() => {});
}
