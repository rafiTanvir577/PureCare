export const adminData = {
  id: 'd7410202-9067-455c-9c67-ef553e189001',
  firstName: 'John',
  lastName: 'Smith',
  email: 'jsmith@gmail.com',
  password: '$2b$10$19ROMWhkRXygnnwKTu6nLucYaVr5pbu45Hb8l95bylq.h.1ZuX7v.', // Plain Password is 'string'
  role: 'OWNER',
};

export const clientData = {
  id: 'd6f0e734-a6bd-4777-ba9b-72cebefbe830',
  firstName: 'Adam',
  lastName: 'Rozario',
  email: 'adam@gmail.com',
  password: '$2b$10$19ROMWhkRXygnnwKTu6nLucYaVr5pbu45Hb8l95bylq.h.1ZuX7v.', // Plain Password is 'string'
  role: 'CLIENT',
  admins: ['d7410202-9067-455c-9c67-ef553e189001'],
};

export const ownerData = {
  id: 'd0000202-9067-455c-9c67-ef553e188888',
  email: 'henry@gmail.com',
  password: '$2b$10$19ROMWhkRXygnnwKTu6nLucYaVr5pbu45Hb8l95bylq.h.1ZuX7v.', // Plain Password is 'string'
  role: 'OWNER',
};
