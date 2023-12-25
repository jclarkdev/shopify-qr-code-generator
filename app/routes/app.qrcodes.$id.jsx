import { useState, useEffect } from "react";
import { json, redirect } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useNavigate,
} from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  Bleed,
  Button,
  ChoiceList,
  ColorPicker,
  Divider,
  EmptyState,
  InlineStack,
  InlineError,
  Layout,
  Page,
  Text,
  TextField,
  Thumbnail,
  BlockStack,
  PageActions,
} from "@shopify/polaris";
import { ImageMajor } from "@shopify/polaris-icons";
import chroma from "chroma-js";

import db from "../db.server";
import { getQRCode, validateQRCode } from "../models/QRCode.server";

export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);

  if (params.id === "new") {
    return json({
      destination: "product",
      title: "",
    });
  }

  return json(await getQRCode(Number(params.id), admin.graphql));
}

export async function action({ request, params }) {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  const formData = await request.formData();
  const fgColorHex = formData.get("foregroundColor");
  const bgColorHex = formData.get("backgroundColor");

  const qrCodeData = {
    // Extract other QR code relevant data from formData
    title: formData.get("title"),
    productId: formData.get("productId"),
    productVariantId: formData.get("productVariantId"),
    productHandle: formData.get("productHandle"),
    destination: formData.get("destination"),
    // Include the shop information if needed
    shop,
    // Add color information
    foregroundColor: fgColorHex,
    backgroundColor: bgColorHex,
  };

  if (formData.get("action") === "delete") {
    await db.qRCode.delete({ where: { id: Number(params.id) } });
    return redirect("/app");
  }

  const errors = validateQRCode(qrCodeData);

  if (errors) {
    return json({ errors }, { status: 422 });
  }

  // Depending on whether it's a new QR code or an update, handle accordingly
  const qrCode = params.id === "new"
    ? await db.qRCode.create({ data: qrCodeData })
    : await db.qRCode.update({ where: { id: Number(params.id) }, data: qrCodeData });

  return redirect(`/app/qrcodes/${qrCode.id}`);
}


export default function QRCodeForm() {
  const errors = useActionData()?.errors || {};

  const qrCode = useLoaderData();
  const [formState, setFormState] = useState(qrCode);
  const [cleanFormState, setCleanFormState] = useState(qrCode);
  const initialFgColor = qrCode.foregroundColor ? chroma(qrCode.foregroundColor).hsv() : { hue: 0, saturation: 0, brightness: 0, alpha: 1 };
  const initialBgColor = qrCode.backgroundColor ? chroma(qrCode.backgroundColor).hsv() : { hue: 0, saturation: 0, brightness: 1, alpha: 1 };

  // Store the initial color states for comparison later
  const initialFgColorState = initialFgColor;
  const initialBgColorState = initialBgColor;

  const [foregroundColor, setForegroundColor] = useState(initialFgColor);
  const [backgroundColor, setBackgroundColor] = useState(initialBgColor);

  useEffect(() => {
    if (qrCode.foregroundColor && qrCode.backgroundColor) {
      const fgColorHSBA = chroma(qrCode.foregroundColor).hsv();
      const bgColorHSBA = chroma(qrCode.backgroundColor).hsv();

      setForegroundColor({
        hue: fgColorHSBA[0],
        saturation: fgColorHSBA[1],
        brightness: fgColorHSBA[2],
        alpha: 1, // Assuming no alpha channel for HEX colors
      });

      setBackgroundColor({
        hue: bgColorHSBA[0],
        saturation: bgColorHSBA[1],
        brightness: bgColorHSBA[2],
        alpha: 1,
      });
    }
  }, [qrCode.foregroundColor, qrCode.backgroundColor]);

  const isDirty = JSON.stringify(formState) !== JSON.stringify(cleanFormState) ||
                  JSON.stringify(foregroundColor) !== JSON.stringify(initialFgColorState) ||
                  JSON.stringify(backgroundColor) !== JSON.stringify(initialBgColorState);



  const nav = useNavigation();
  const isSaving =
    nav.state === "submitting" && nav.formData?.get("action") !== "delete";
  const isDeleting =
    nav.state === "submitting" && nav.formData?.get("action") === "delete";

  const navigate = useNavigate();

  async function selectProduct() {
    const products = await window.shopify.resourcePicker({
      type: "product",
      action: "select", // customized action verb, either 'select' or 'add',
    });

    if (products) {
      const { images, id, variants, title, handle } = products[0];

      setFormState({
        ...formState,
        productId: id,
        productVariantId: variants[0].id,
        productTitle: title,
        productHandle: handle,
        productAlt: images[0]?.altText,
        productImage: images[0]?.originalSrc,
      });
    }
  }

  const submit = useSubmit();
  function handleSave() {
    const fgColorHex = chroma.hsv([foregroundColor.hue, foregroundColor.saturation, foregroundColor.brightness]).hex();
    const bgColorHex = chroma.hsv([backgroundColor.hue, backgroundColor.saturation, backgroundColor.brightness]).hex();
    const data = new FormData();
    data.append("title", formState.title);
    data.append("productId", formState.productId || "");
    data.append("productVariantId", formState.productVariantId || "");
    data.append("productHandle", formState.productHandle || "");
    data.append("destination", formState.destination);
    data.append("foregroundColor", fgColorHex);
    data.append("backgroundColor", bgColorHex);

    setCleanFormState({ ...formState });
    submit(data, { method: "post" });
  }



  return (
    <Page>
      <ui-title-bar title={qrCode.id ? "Edit QR code" : "Create new QR code"}>
        <button variant="breadcrumb" onClick={() => navigate("/app")}>
          QR codes
        </button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="500">
                <Text as={"h2"} variant="headingLg">
                  Title
                </Text>
                <TextField
                  id="title"
                  helpText="Only store staff can see this title"
                  label="title"
                  labelHidden
                  autoComplete="off"
                  value={formState.title}
                  onChange={(title) => setFormState({ ...formState, title })}
                  error={errors.title}
                />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between">
                  <Text as={"h2"} variant="headingLg">
                    Product
                  </Text>
                  {formState.productId ? (
                    <Button variant="plain" onClick={selectProduct}>
                      Change product
                    </Button>
                  ) : null}
                </InlineStack>
                {formState.productId ? (
                  <InlineStack blockAlign="center" gap="500">
                    <Thumbnail
                      source={formState.productImage || ImageMajor}
                      alt={formState.productAlt}
                    />
                    <Text as="span" variant="headingMd" fontWeight="semibold">
                      {formState.productTitle}
                    </Text>
                  </InlineStack>
                ) : (
                  <BlockStack gap="200">
                    <Button onClick={selectProduct} id="select-product">
                      Select product
                    </Button>
                    {errors.productId ? (
                      <InlineError
                        message={errors.productId}
                        fieldID="myFieldID"
                      />
                    ) : null}
                  </BlockStack>
                )}
                <Bleed marginInlineStart="200" marginInlineEnd="200">
                  <Divider />
                </Bleed>
                <InlineStack gap="500" align="space-between" blockAlign="start">
                  <ChoiceList
                    title="Scan destination"
                    choices={[
                      { label: "Link to product page", value: "product" },
                      {
                        label: "Link to checkout page with product in the cart",
                        value: "cart",
                      },
                    ]}
                    selected={[formState.destination]}
                    onChange={(destination) =>
                      setFormState({
                        ...formState,
                        destination: destination[0],
                      })
                    }
                    error={errors.destination}
                  />
                  {qrCode.destinationUrl ? (
                    <Button
                      variant="plain"
                      url={qrCode.destinationUrl}
                      target="_blank"
                    >
                      Go to destination URL
                    </Button>
                  ) : null}
                </InlineStack>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="500">
                <Text as={"h2"} variant="headingLg">Customize QR Code</Text>
                <BlockStack gap="500">
                  <Text>Foreground Color</Text>
                  <ColorPicker onChange={setForegroundColor} color={foregroundColor} />
                </BlockStack>
                <BlockStack gap="500">
                  <Text>Background Color</Text>
                  <ColorPicker onChange={setBackgroundColor} color={backgroundColor} />
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <Text as={"h2"} variant="headingLg">
              QR code
            </Text>
            {qrCode ? (
              <EmptyState image={qrCode.image} imageContained={true} />
            ) : (
              <EmptyState image="">
                Your QR code will appear here after you save
              </EmptyState>
            )}
            <BlockStack gap="300">
              <Button
                disabled={!qrCode?.image}
                url={qrCode?.image}
                download
                variant="primary"
              >
                Download
              </Button>
              <Button
                disabled={!qrCode.id}
                url={`/qrcodes/${qrCode.id}`}
                target="_blank"
              >
                Go to public URL
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          <PageActions
            secondaryActions={[
              {
                content: "Delete",
                loading: isDeleting,
                disabled: !qrCode.id || !qrCode || isSaving || isDeleting,
                destructive: true,
                outline: true,
                onAction: () =>
                  submit({ action: "delete" }, { method: "post" }),
              },
            ]}
            primaryAction={{
              content: qrCode.id ? "Update QR Code" : "Generate QR Code",
              loading: isSaving,
              disabled: !isDirty || isSaving || isDeleting,
              onAction: handleSave,
            }}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
