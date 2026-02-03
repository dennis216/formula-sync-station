import JSZip from 'jszip';

export interface DocumentElement {
  type: 'text' | 'image' | 'heading' | 'break';
  content?: string; // Text content for text/heading types
  imageRef?: string; // Reference like "image70" for image types
  imageNumber?: number; // Extracted number from imageRef
  level?: number; // Heading level (1-6) for heading types
}

export interface ParsedDocument {
  elements: DocumentElement[];
  title: string | null;
  imageCount: number;
  textBlockCount: number;
}

/**
 * Parse the document.xml from a DOCX ZIP file to extract the document structure.
 * Returns an array of elements in document order: text blocks, images, headings.
 */
export async function parseDocumentXml(file: File): Promise<ParsedDocument> {
  const result: ParsedDocument = {
    elements: [],
    title: null,
    imageCount: 0,
    textBlockCount: 0,
  };

  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    // Find document.xml
    const documentXmlPath = Object.keys(contents.files).find(
      (path) => path.toLowerCase() === 'word/document.xml'
    );

    if (!documentXmlPath) {
      console.warn('[DOCX Parser] No word/document.xml found');
      return result;
    }

    const documentXml = await contents.files[documentXmlPath].async('string');
    console.log(`[DOCX Parser] Loaded document.xml (${documentXml.length} chars)`);

    // Also load relationships file to map image references
    const relsPath = 'word/_rels/document.xml.rels';
    let relsXml = '';
    if (contents.files[relsPath]) {
      relsXml = await contents.files[relsPath].async('string');
    }

    // Build a map of relationship IDs to image filenames
    const rIdToImage = new Map<string, string>();
    if (relsXml) {
      const relMatches = relsXml.matchAll(
        /Id="(rId\d+)"[^>]*Target="media\/([^"]+)"/gi
      );
      for (const match of relMatches) {
        rIdToImage.set(match[1], match[2]);
      }
      console.log(`[DOCX Parser] Found ${rIdToImage.size} image relationships`);
    }

    // Parse the document XML using regex (simpler than full DOM parsing)
    // We'll look for paragraphs <w:p>, runs <w:r>, text <w:t>, and drawings

    // First, let's extract all paragraphs
    const paragraphPattern = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi;
    let paragraphMatch;
    let currentTextBlock = '';

    while ((paragraphMatch = paragraphPattern.exec(documentXml)) !== null) {
      const paragraphContent = paragraphMatch[1];

      // Check if this paragraph contains an image (drawing or pict)
      const hasDrawing = /<w:drawing\b/i.test(paragraphContent);
      const hasPict = /<w:pict\b/i.test(paragraphContent);

      if (hasDrawing || hasPict) {
        // Flush any accumulated text first
        if (currentTextBlock.trim()) {
          result.elements.push({
            type: 'text',
            content: currentTextBlock.trim(),
          });
          result.textBlockCount++;
          currentTextBlock = '';
        }

        // Extract image reference
        let imageRef: string | null = null;

        // Try to find rId reference in drawings
        const rIdMatch = paragraphContent.match(/r:embed="(rId\d+)"/i);
        if (rIdMatch && rIdToImage.has(rIdMatch[1])) {
          const filename = rIdToImage.get(rIdMatch[1])!;
          imageRef = filename.replace(/\.[^.]+$/, ''); // Remove extension
        }

        // Fallback: look for image filename patterns directly
        if (!imageRef) {
          const imageFileMatch = paragraphContent.match(/image(\d+)/i);
          if (imageFileMatch) {
            imageRef = `image${imageFileMatch[1]}`;
          }
        }

        // If still no reference, try to find any number in blip/imagedata
        if (!imageRef) {
          const blipMatch = paragraphContent.match(/<a:blip[^>]*>/i);
          if (blipMatch) {
            const numMatch = blipMatch[0].match(/(\d+)/);
            if (numMatch) {
              imageRef = `image${numMatch[1]}`;
            }
          }
        }

        if (imageRef) {
          const numMatch = imageRef.match(/(\d+)/);
          result.elements.push({
            type: 'image',
            imageRef,
            imageNumber: numMatch ? parseInt(numMatch[1], 10) : undefined,
          });
          result.imageCount++;
          console.log(`[DOCX Parser] Found image: ${imageRef}`);
        }
      } else {
        // Extract text from this paragraph
        const textPattern = /<w:t\b[^>]*>([^<]*)<\/w:t>/gi;
        let textMatch;
        let paragraphText = '';

        while ((textMatch = textPattern.exec(paragraphContent)) !== null) {
          paragraphText += textMatch[1];
        }

        // Check if this is a heading
        const isHeading = /<w:pStyle[^>]*w:val="Heading(\d+)"/i.test(paragraphContent);
        const headingMatch = paragraphContent.match(/<w:pStyle[^>]*w:val="Heading(\d+)"/i);

        if (isHeading && headingMatch && paragraphText.trim()) {
          // Flush accumulated text first
          if (currentTextBlock.trim()) {
            result.elements.push({
              type: 'text',
              content: currentTextBlock.trim(),
            });
            result.textBlockCount++;
            currentTextBlock = '';
          }

          result.elements.push({
            type: 'heading',
            content: paragraphText.trim(),
            level: parseInt(headingMatch[1], 10),
          });

          // Capture document title from first heading
          if (!result.title) {
            result.title = paragraphText.trim();
          }
        } else if (paragraphText.trim()) {
          // Add to current text block with paragraph break
          if (currentTextBlock) {
            currentTextBlock += '\n';
          }
          currentTextBlock += paragraphText;
        } else if (currentTextBlock && !paragraphText.trim()) {
          // Empty paragraph acts as a break
          currentTextBlock += '\n\n';
        }
      }
    }

    // Flush any remaining text
    if (currentTextBlock.trim()) {
      result.elements.push({
        type: 'text',
        content: currentTextBlock.trim(),
      });
      result.textBlockCount++;
    }

    console.log(`[DOCX Parser] ✅ Parsed document structure:`);
    console.log(`   - Elements: ${result.elements.length}`);
    console.log(`   - Text blocks: ${result.textBlockCount}`);
    console.log(`   - Images: ${result.imageCount}`);
    console.log(`   - Title: "${result.title || 'None'}"`);

    return result;
  } catch (error) {
    console.error('[DOCX Parser] Failed to parse:', error);
    return result;
  }
}
