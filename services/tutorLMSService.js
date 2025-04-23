// services/tutorLMSService.js
const axios = require('axios');
const WP_BASE = process.env.WORDPRESS_API_URL;          // e.g. https://your-site.com
const WP_USER = process.env.WORDPRESS_USERNAME;        // admin user
const WP_PASS = process.env.WORDPRESS_PASSWORD;        // admin password

async function getJwtToken() {
  const { data } = await axios.post(`${WP_BASE}/wp-json/jwt-auth/v1/token`, {
    username: WP_USER,
    password: WP_PASS
  });
  return data.token;
}

async function createWPUser(token, { username, email, password, roles }) {
  try {
    const res = await axios.post(
      `${WP_BASE}/wp-json/wp/v2/users`,
      { username, email, password, roles },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  } catch (err) {
    // if user exists, pull existing user
    if (err.response?.status === 400 && err.response.data.code === 'existing_user_login') {
      // fetch by email
      const list = await axios.get(
        `${WP_BASE}/wp-json/wp/v2/users`,
        {
          params: { search: email },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return list.data[0];
    }
    throw err;
  }
}

async function enrollUser(token, { userId, courseId, tagId }) {
  return axios.post(
    `${WP_BASE}/wp-json/custom/v1/enroll`,
    { user_id: userId, course_id: courseId, tag_id: tagId },
    { headers: { Authorization: `Bearer ${token}` } }
  ).then(r => r.data);
}

module.exports = {
  getJwtToken,
  createWPUser,
  enrollUser,
};
