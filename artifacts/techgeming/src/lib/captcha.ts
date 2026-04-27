// Math captcha generator — simple human-verification.
export interface Captcha {
  question: string;
  answer: number;
}
export function generateCaptcha(): Captcha {
  const ops = ["+", "-", "×"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a = Math.floor(Math.random() * 9) + 1;
  let b = Math.floor(Math.random() * 9) + 1;
  if (op === "-" && b > a) [a, b] = [b, a];
  let answer = 0;
  if (op === "+") answer = a + b;
  if (op === "-") answer = a - b;
  if (op === "×") answer = a * b;
  return { question: `${a} ${op} ${b}`, answer };
}
