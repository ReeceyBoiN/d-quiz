export default (app) => {
  app.get('/users/me', (_req, res) => {
    res.json({ id: 'local', name: 'Local User' });
  });
};
