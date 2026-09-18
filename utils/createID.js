const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lowercase = uppercase.toLowerCase();
const numbers = "1234567890";
const chars = uppercase + lowercase + numbers;

export default (length = 10) => {
  let pass = "";

  while (pass.length < length) {
    pass += chars[Math.floor(Math.random() * chars.length)];
  }

  return pass;
};
