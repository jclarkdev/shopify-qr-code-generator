import { useState, useCallback, useMemo } from 'react';
import { json } from '@remix-run/node';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { authenticate } from '../shopify.server';
import {
  Card,
  EmptyState,
  Layout,
  Page,
  IndexTable,
  IndexFilters,
  Thumbnail,
  Text,
  Icon,
  InlineStack,
  FooterHelp,
  Link,
  ChoiceList,
  RangeSlider,
  Badge,
  TextField,
  useSetIndexFiltersMode,
  useIndexResourceState,
  useBreakpoints
} from '@shopify/polaris';

import { getQRCodes } from '../models/QRCode.server';
import { DiamondAlertMajor, ImageMajor } from '@shopify/polaris-icons';

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const qrCodes = await getQRCodes(session.shop, admin.graphql);
  return json({ qrCodes });
}

const EmptyQRCodeState = ({ onAction }) => (
  <EmptyState
    heading="Create unique QR codes for your product"
    action={{
      content: "Create QR code",
      onAction,
    }}
    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
  >
    <p>Build QR code campaigns for customers to scan with their phone.</p>
  </EmptyState>
);

function IndexTableWithViewsSearchFilterSorting() {
  const { qrCodes } = useLoaderData();
  const navigate = useNavigate();
  const [selected, setSelected] = useState(0);
  const [sortSelected, setSortSelected] = useState(['campaign_asc']);
  const [queryValue, setQueryValue] = useState('');
  const [views, setViews] = useState(['All', 'Product Links', 'Checkout Links']);

  // Functions for views manipulation
  const handleViewRename = (index, newName) => {
    const newViews = [...views];
    newViews[index] = newName;
    setViews(newViews);
  };

  const handleViewDuplicate = (index) => {
    const newViews = [...views];
    newViews.splice(index + 1, 0, `${views[index]} (copy)`);
    setViews(newViews);
  };

  const handleViewDelete = (index) => {
    const newViews = [...views];
    newViews.splice(index, 1);
    setViews(newViews);
  };

  const handleCreateNewView = (newName) => {
    setViews([...views, newName]);
  };

  // State for Sorting and Filtering
  const [moneySpent, setMoneySpent] = useState([0, 500]);
  const [taggedWith, setTaggedWith] = useState('');

  // Callbacks for Sorting and Filtering
  const handleMoneySpentChange = useCallback((value) => setMoneySpent(value), []);
  const handleTaggedWithChange = useCallback((value) => setTaggedWith(value), []);
  const handleMoneySpentRemove = useCallback(() => setMoneySpent([0, 500]), []);
  const handleTaggedWithRemove = useCallback(() => setTaggedWith(''), []);

  const filters = [
    {
      key: 'moneySpent',
      label: 'Money spent',
      filter: (
        <RangeSlider
          label="Money spent is between"
          labelHidden
          value={moneySpent}
          prefix="$"
          output
          min={0}
          max={2000}
          step={1}
          onChange={handleMoneySpentChange}
        />
      ),
    },
    {
      key: 'taggedWith',
      label: 'Tagged with',
      filter: (
        <TextField
          label="Tagged with"
          value={taggedWith}
          onChange={handleTaggedWithChange}
          autoComplete="off"
          labelHidden
        />
      ),
      shortcut: true,
    },
    // Add more filters as needed
  ];

  const appliedFilters = [];
  if (moneySpent[0] !== 0 || moneySpent[1] !== 500) {
    const label = `Money spent is between $${moneySpent[0]} and $${moneySpent[1]}`;
    appliedFilters.push({ key: 'moneySpent', label, onRemove: handleMoneySpentRemove });
  }
  if (taggedWith) {
    appliedFilters.push({ key: 'taggedWith', label: `Tagged with ${taggedWith}`, onRemove: handleTaggedWithRemove });
  }

  // QR code filtering logic
  const filteredQRCodes = useMemo(() => {
    let filtered = qrCodes;
    switch (views[selected]) {
      case 'Product Links':
        filtered = filtered.filter(qr => qr.destination === 'product');
        break;
      case 'Checkout Links':
        filtered = filtered.filter(qr => qr.destination === 'checkout');
        break;
      default:
        break;
    }
    if (queryValue) {
      filtered = filtered.filter(qr => qr.title.toLowerCase().includes(queryValue.toLowerCase()));
    }
    if (sortSelected[0] === 'campaign_asc') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortSelected[0] === 'campaign_desc') {
      filtered.sort((a, b) => b.title.localeCompare(a.title));
    }
    return filtered;
  }, [qrCodes, selected, views, queryValue, sortSelected]);

  const sortOptions = [
    { label: 'Campaign Ascending', value: 'campaign_asc' },
    { label: 'Campaign Descending', value: 'campaign_desc' },
    // Add more sort options if necessary
  ];

  return (
    <Page>
      <ui-title-bar title="QR Codes">
        <button variant="primary" onClick={() => navigate("/app/qrcodes/new")}>
          Create QR Code
        </button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <Card padding="0">
          <IndexFilters
            sortOptions={sortOptions}
            sortSelected={sortSelected}
            queryValue={queryValue}
            queryPlaceholder="Search QR Codes"
            onQueryChange={setQueryValue}
            onQueryClear={() => setQueryValue('')}
            onSort={setSortSelected}
            tabs={views.map((view, index) => ({
              content: view,
              id: `${view}-${index}`,
              actions: [
                {
                  type: 'rename',
                  onAction: () => handleViewRename(index, 'New Name'),
                },
                {
                  type: 'duplicate',
                  onPrimaryAction: () => handleViewDuplicate(index),
                },
                {
                  type: 'delete',
                  onPrimaryAction: () => handleViewDelete(index),
                },
              ],
            }))}
            selected={selected}
            onSelect={setSelected}
            canCreateNewView
            onCreateNewView={handleCreateNewView}
            filters={filters}
            appliedFilters={appliedFilters}
            onClearAll={() => {
              handleMoneySpentRemove();
              handleTaggedWithRemove();
              setQueryValue('');
            }}
            // Add other necessary props
          />
            <IndexTable
              resourceName={{ singular: 'QR code', plural: 'QR codes' }}
              itemCount={filteredQRCodes.length}
              headings={[
                { title: 'Thumbnail' },
                { title: 'Campaign' },
                { title: 'Content' },
                { title: 'Date created' },
                { title: 'Scans' },
              ]}
            >
              {filteredQRCodes.map((qrCode) => (
                <IndexTable.Row key={qrCode.id} id={qrCode.id}>
                  <IndexTable.Cell>
                    <Thumbnail
                      source={qrCode.productImage || ImageMajor}
                      alt={qrCode.productTitle}
                      size="small"
                    />
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <Link to={`qrcodes/${qrCode.id}`}>{qrCode.title}</Link>
                  </IndexTable.Cell>
                  <IndexTable.Cell>{qrCode.productTitle}</IndexTable.Cell>
                  <IndexTable.Cell>{new Date(qrCode.createdAt).toDateString()}</IndexTable.Cell>
                  <IndexTable.Cell>{qrCode.scans}</IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export default IndexTableWithViewsSearchFilterSorting;
