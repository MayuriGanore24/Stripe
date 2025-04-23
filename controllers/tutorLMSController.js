// controllers/tutorLMSController.js
const {
    getJwtToken,
    createWPUser,
    enrollUser
  } = require('../services/tutorLMSService');
  
  async function enrollAfterPayment({ email, username, password, role, courseId, tagId }) {
    // 1. get a WP JWT
    const token = await getJwtToken();
  
    // 2. create or fetch the WP user
    const wpUser = await createWPUser(token, {
      username,
      email,
      password,
      roles: [role || 'subscriber']
    });
  
    // 3. enroll them
    const enrollmentResult = await enrollUser(token, {
      userId: wpUser.id,
      courseId,
      tagId
    });
  
    return { wpUser, enrollmentResult };
  }
  
  module.exports = {
    enrollAfterPayment,
  };
  