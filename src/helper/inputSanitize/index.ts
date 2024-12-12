import { filterXSS } from 'xss';

const options = {
  whiteList: {
    a: ['href'],
    // Customize the whitelist based on your application's needs.
  },
  stripIgnoreTag: true, // Remove non-allowed tags
  stripIgnoreTagBody: ['script'],
};

export const sanitizeRequestBodyWithXss = (body: any): any => {
  if (typeof body === 'object') {
    if (Array.isArray(body)) {
      // If the body is an array, iterate through its elements and sanitize each one
      for (let i = 0; i < body.length; i++) {
        body[i] = sanitizeRequestBodyWithXss(body[i]);
      }
    } else {
      // If the body is an object, iterate through its properties and sanitize each one
      for (const key in body) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
          body[key] = sanitizeRequestBodyWithXss(body[key]);
        }
      }
    }
  } else if (typeof body === 'string') {
    // If the body is a string, sanitize it using xss with the defined options
    body = filterXSS(body, options);
  }
  return body;
};
