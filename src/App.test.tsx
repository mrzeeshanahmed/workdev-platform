import { render, screen } from '@testing-library/react';

import App from './App';
import { AppProviders } from './providers/AppProviders';

test('renders marketplace home by default', async () => {
  render(
    <AppProviders>
      <App />
    </AppProviders>,
  );

  const marketplaceHeading = await screen.findByText(/Marketplace Module/i);
  expect(marketplaceHeading).toBeInTheDocument();
});
