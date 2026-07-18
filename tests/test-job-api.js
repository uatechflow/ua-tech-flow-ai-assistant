// test-job-api.js — перевірка API Job Advisor
const API_URL = 'https://job.uatechflow.org/process';

const testData = {
  action: 'search_jobs',
  title: 'Frontend Developer',
  country: 'Switzerland',
  language: 'en'
};

console.log('Testing Job Advisor API:', API_URL);

fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
})
  .then(res => {
    console.log('Status:', res.status);
    return res.json();
  })
  .then(data => {
    console.log('✅ Response received:');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
  });