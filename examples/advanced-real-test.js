import { Selector } from 'testcafe';

fixture('Advanced Real Browser Test')
  .page('data:text/html,<html><body><div id="app"><h1>Advanced Test Page</h1><form id="contact-form"><input id="name" placeholder="Name" required><input id="email" type="email" placeholder="Email" required><textarea id="message" placeholder="Message"></textarea><button type="submit" id="submit-btn">Send Message</button></form><div id="result" style="display:none;color:green;">Message sent successfully!</div></div></body></html>');

test('should handle complex form interactions', async t => {
  // Test form validation
  await t
    .click('#submit-btn')
    .expect(Selector('#name:invalid').exists).ok('Name field should be invalid when empty');

  // Fill form with valid data
  await t
    .typeText('#name', 'John Doe')
    .typeText('#email', 'john.doe@example.com')
    .typeText('#message', 'This is a test message for the advanced form.');

  // Verify form is now valid
  await t
    .expect(Selector('#name:valid').exists).ok('Name field should be valid')
    .expect(Selector('#email:valid').exists).ok('Email field should be valid');

  // Submit form and verify result
  await t
    .click('#submit-btn')
    .expect(Selector('#result').visible).ok('Result message should be visible')
    .expect(Selector('#result').innerText).eql('Message sent successfully!');
});

test('should handle keyboard navigation', async t => {
  // Test tab navigation
  await t
    .pressKey('tab') // Focus on name field
    .typeText(Selector(':focus'), 'Jane Smith')
    .pressKey('tab') // Move to email field
    .typeText(Selector(':focus'), 'jane.smith@example.com')
    .pressKey('tab') // Move to message field
    .typeText(Selector(':focus'), 'Testing keyboard navigation')
    .pressKey('tab') // Move to submit button
    .pressKey('enter'); // Submit form

  // Verify submission
  await t
    .expect(Selector('#result').visible).ok('Form should submit via keyboard');
});

test('should handle responsive behavior', async t => {
  // Test different viewport sizes
  await t
    .resizeWindow(1920, 1080)
    .expect(Selector('#app').clientWidth).gte(1900, 'App should use full width on desktop');

  await t
    .resizeWindow(768, 1024)
    .expect(Selector('#app').clientWidth).lte(768, 'App should adapt to tablet width');

  await t
    .resizeWindow(375, 667)
    .expect(Selector('#app').clientWidth).lte(375, 'App should adapt to mobile width');
});

test('should handle dynamic content updates', async t => {
  // Fill and submit form
  await t
    .typeText('#name', 'Dynamic User')
    .typeText('#email', 'dynamic@example.com')
    .typeText('#message', 'Testing dynamic updates')
    .click('#submit-btn');

  // Wait for dynamic content
  await t
    .expect(Selector('#result').visible).ok('Result should appear')
    .wait(1000); // Simulate processing time

  // Verify form reset (if implemented)
  await t
    .expect(Selector('#name').value).eql('', 'Name field should be cleared after submission', { timeout: 5000 });
});

test('should capture screenshots on failure', async t => {
  // This test intentionally fails to demonstrate screenshot capture
  await t
    .typeText('#name', 'Screenshot Test')
    .expect(Selector('#nonexistent-element').exists).ok('This will fail and capture a screenshot');
});