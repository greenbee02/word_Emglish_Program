import { auth, authConfigured, authRedirect } from './auth.js';
import { escapeHtml } from './layout.js';

const errorMessage = error => ({
  invalid_credentials: '이메일 또는 비밀번호를 확인해 주세요.',
  email_not_confirmed: '가입한 이메일에서 인증 링크를 먼저 눌러 주세요.',
  over_email_send_rate_limit: '이메일 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  weak_password: '비밀번호를 더 길고 안전하게 설정해 주세요.',
  same_password: '이전 비밀번호와 다른 비밀번호를 입력해 주세요.',
}[error?.code] || '요청을 처리하지 못했습니다. 입력 내용과 네트워크 연결을 확인해 주세요.');

export function closeAccount() {
  const dialog = document.querySelector('#account-dialog');
  if (dialog?.open) dialog.close();
  dialog?.remove();
}

export function showAccount(initialMode = 'signin', { client = auth, configured = authConfigured, redirect = authRedirect, onComplete = message => alert(message) } = {}) {
  closeAccount();
  const dialog = document.createElement('dialog'); dialog.id = 'account-dialog'; dialog.className = 'account-dialog';
  document.body.append(dialog);
  function draw(mode, message = '') {
    const titles = { signin: '다시 만나 반가워요', signup: '나만의 단어장을 시작해요', reset: '비밀번호 재설정', recovery: '새 비밀번호 설정' };
    dialog.innerHTML = `<button class="dialog-close" aria-label="닫기">×</button><p class="eyebrow">WORD GARDEN</p><h2 id="account-title">${titles[mode]}</h2><p class="account-description">${mode === 'recovery' ? '새 비밀번호를 입력해 계정을 안전하게 지켜 주세요.' : '단어장과 학습 기록을 내 계정에 보관하세요.'}</p>${configured ? `<form><label ${mode === 'recovery' ? 'hidden' : ''}>이메일<input name="email" type="email" autocomplete="email" ${mode !== 'recovery' ? 'required' : ''}></label>${mode !== 'reset' ? `<label>비밀번호<input name="password" type="password" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}" minlength="${mode === 'signin' ? 1 : 8}" required ${mode !== 'signin' ? 'aria-describedby="password-help"' : ''}></label>${mode !== 'signin' ? '<small id="password-help">8자 이상으로 입력해 주세요.</small><label>비밀번호 확인<input name="confirm" type="password" autocomplete="new-password" minlength="8" required></label>' : ''}` : ''}<p class="account-feedback" role="status" aria-live="polite">${escapeHtml(message)}</p><button class="primary" type="submit">${({ signin: '로그인', signup: '회원가입', reset: '재설정 이메일 보내기', recovery: '비밀번호 변경' })[mode]}</button></form><div class="account-links">${mode === 'signin' ? '<button data-mode="signup">회원가입</button><button data-mode="reset">비밀번호를 잊으셨나요?</button>' : '<button data-mode="signin">로그인으로 돌아가기</button>'}</div>` : '<p role="status">현재는 기기 저장 모드입니다. 로그인은 서비스 설정이 완료되면 사용할 수 있어요.</p>'}`;
    dialog.setAttribute('aria-labelledby', 'account-title');
    dialog.querySelector('.dialog-close').onclick = () => dialog.close();
    dialog.querySelectorAll('[data-mode]').forEach(el => el.onclick = () => draw(el.dataset.mode));
    dialog.querySelector('form')?.addEventListener('submit', async e => {
      e.preventDefault(); const form = e.target, values = Object.fromEntries(new FormData(form));
      const feedback = form.querySelector('.account-feedback'), button = form.querySelector('[type=submit]');
      if (button.disabled || !form.reportValidity()) return;
      if (values.confirm !== undefined && values.confirm !== values.password) { feedback.textContent = '비밀번호 확인이 일치하지 않습니다.'; return; }
      button.disabled = true; feedback.textContent = '처리 중입니다.';
      const links = [...dialog.querySelectorAll('[data-mode]')];
      links.forEach(link => { link.disabled = true; });
      try {
        const result = mode === 'signin' ? await client.signInWithPassword({ email: values.email, password: values.password })
          : mode === 'signup' ? await client.signUp({ email: values.email, password: values.password, options: { emailRedirectTo: redirect() } })
          : mode === 'reset' ? await client.resetPasswordForEmail(values.email, { redirectTo: `${redirect()}?recovery=1` })
          : await client.updateUser({ password: values.password });
        if (!dialog.isConnected || !form.isConnected) return;
        if (result.error) throw result.error;
        if (mode === 'signin' || (mode === 'signup' && result.data.session)) dialog.close();
        else if (mode === 'recovery') { dialog.close(); onComplete('비밀번호를 변경했습니다.'); }
        else {
          feedback.textContent = mode === 'signup' ? '가입 가능한 이메일이면 인증 메일이 발송됩니다. 메일의 링크를 누른 뒤 로그인해 주세요.' : '가입된 이메일이면 재설정 링크가 발송됩니다. 메일함과 스팸함을 확인해 주세요.';
          form.reset();
        }
      } catch (error) { if (dialog.isConnected && form.isConnected) feedback.textContent = errorMessage(error); }
      finally { button.disabled = false; links.forEach(link => { link.disabled = false; }); }
    });
  }
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  draw(initialMode); dialog.showModal();
  return dialog;
}
