import { Selector } from 'testcafe';

fixture('Simple Real Test')
  .page('data:text/html,<html><body><h1 id="title">Hello TestCafe</h1><button id="click-me">Click Me</button><div id="result" style="display:none;">Clicked!</div></body></html>');

test('should interact with page elements', async t => {
  // Check initial state
  await t
    .expect(Selector('#title').innerText).eql('Hello TestCafe')
    .expect(Selector('#result').visible).notOk();

  // Click button and verify result
  await t
    .click('#click-me')
    .expect(Selector('#result').visible).ok()
    .expect(Selector('#result').innerText).eql('Clicked!');
});

test('should handle multiple assertions', async t => {
  const title = Selector('#title');
  const button = Selector('#click-me');

  await t
    .expect(title.exists).ok()
    .expect(button.exists).ok()
    .expect(title.tagName).eql('h1')
    .expect(button.tagName).eql('button');
});