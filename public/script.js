document.addEventListener('DOMContentLoaded', () => {
  // Get elements
  const courseButtons = document.querySelectorAll('[data-course-id]');
  const courseDetails = document.getElementById('course-details');
  const detailsContent = document.getElementById('details-content');
  const checkoutButton = document.getElementById('checkout-button');
  
  // Store the current course data
  let currentCourseData = null;
  
  // Add click event to all course buttons
  courseButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const courseId = button.getAttribute('data-course-id');
      await fetchCourseData(courseId);
    });
  });
  
  // Add click event to checkout button
  checkoutButton.addEventListener('click', async () => {
    if (currentCourseData) {
      try {
        const response = await fetch('http://localhost:5000/create-checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: currentCourseData.name,
            amount: currentCourseData.price * 100, // Convert to cents
            email: currentCourseData.email || '', // Optional fallback
            itemId: currentCourseData.id,
            itemType: currentCourseData.plan_type,
            priceId: currentCourseData.stripe_price_id
          })
        });
  
        const data = await response.json();
  
        if (!response.ok) {
          console.error('Server error:', data);
          alert('Failed to create checkout session: ' + (data.message || 'Unknown error'));
          return;
        }
  
        // ✅ Store subscriptionId both in localStorage and console log it
        if (data.subscriptionId) {
          localStorage.setItem("subscriptionId", data.subscriptionId);
          console.log("Stored subscription ID:", data.subscriptionId);
        }
        
        // ✅ Redirect user to Stripe Checkout
        if (data.url) {
          window.location.href = data.url;
        } else {
          console.error('No URL returned:', data);
          alert('Failed to create checkout session.');
        }
      } catch (error) {
        console.error('Error creating checkout session:', error);
        alert('Error initiating payment.');
      }
    }
  });
    
  // Function to fetch course data from API
  async function fetchCourseData(courseId) {
    try {
      const response = await fetch(`/api/courses/${courseId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch course data');
      }
      
      const data = await response.json();
      console.log('Course data:', data);
      
      // Store the current course data
      currentCourseData = data;
      
      // Display the course details
      displayCourseDetails(data);
      
      // Show the details section
      courseDetails.classList.remove('hidden');
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error fetching course data');
    }
  }
  
  // Function to display course details
  function displayCourseDetails(course) {
    detailsContent.innerHTML = `
      <div class="detail-item">
        <strong>Course Name:</strong> ${course.plan_type || 'N/A'}
      </div>
      <div class="detail-item">
        <strong>Course ID:</strong> ${course.course_id || 'N/A'}
      </div>
      <div class="detail-item">
        <strong>Price:</strong> $${course.price || 0} ${course.currency || 'USD'} (${course.price_type || 'One-time'})
      </div>
      <div class="detail-item">
        <strong>Status:</strong> ${course.status || 'Active'}
      </div>
      <div class="detail-item">
        <strong>Stripe Price ID:</strong> ${course.stripe_price_id || 'N/A'}
      </div>
      <div class="detail-item">
        <strong>Stripe Product ID:</strong> ${course.stripe_product_id || 'N/A'}
      </div>
    `;
  }
});
