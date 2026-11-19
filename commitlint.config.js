const isDependabotCommit = (message) => message.includes('Signed-off-by: dependabot[bot]');

export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [isDependabotCommit],
  rules: {
    'body-max-line-length': [2, 'always', 100],
    'footer-max-line-length': [0]
  }
};
