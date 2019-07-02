import bcrypt from 'bcrypt';

const salt = bcrypt.genSaltSync(10);
export const secret_key = bcrypt.hashSync('bigdata',salt);
export const client_id = 'AXIOM926372XS';

