const overlay = document.getElementById('modal-overlay')!;
const titleEl = document.getElementById('modal-title')!;
const messageEl = document.getElementById('modal-message')!;
const okBtn = document.getElementById('modal-ok')!;
const cancelBtn = document.getElementById('modal-cancel')!;

export function showModal(title: string, message: string, showCancel = false): Promise<boolean> {
  return new Promise((resolve) => {
    titleEl.textContent = title;
    messageEl.textContent = message;
    (cancelBtn as HTMLElement).style.display = showCancel ? '' : 'none';
    overlay.hidden = false;

    const cleanup = () => {
      overlay.hidden = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
    };
    const onOk = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}
