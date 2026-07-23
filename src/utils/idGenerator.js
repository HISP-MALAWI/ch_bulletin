export function generateDhis2Uid() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const alnum = letters + '0123456789';
  let uid = letters.charAt(Math.floor(Math.random() * letters.length));
  for (let i = 0; i < 10; i++) {
    uid += alnum.charAt(Math.floor(Math.random() * alnum.length));
  }
  return uid;
}