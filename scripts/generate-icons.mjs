import sharp from 'sharp';
import { optimize } from 'svgo';
import { promises as fs } from 'fs';
import path from 'path';

const ICONS = [
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
];

async function generateIcons() {
  try {
    const svgPath = path.resolve('public', 'logo.svg');
    const outputDir = path.resolve('public');

    console.log('Reading SVG logo...');
    const svgBuffer = await fs.readFile(svgPath);

    console.log('Optimizing SVG...');
    const optimizedSvg = optimize(svgBuffer.toString(), {
      multipass: true,
      plugins: [
        { name: 'preset-default', params: { overrides: { removeViewBox: false } } },
        'removeDimensions',
      ],
    });

    const optimizedSvgBuffer = Buffer.from(optimizedSvg.data);

    console.log('Generating PNG icons...');
    for (const icon of ICONS) {
      const outputPath = path.join(outputDir, icon.name);
      await sharp(optimizedSvgBuffer)
        .resize(icon.size, icon.size)
        .png()
        .toFile(outputPath);
      console.log(`- Generated ${icon.name}`);
    }

    console.log('Generating favicon.ico...');
    const faviconInputBuffer = await fs.readFile(path.join(outputDir, 'favicon-32.png'));
    await sharp(faviconInputBuffer)
      .resize(32, 32)
      .toFile(path.join(outputDir, 'favicon.ico'));
    console.log('- Generated favicon.ico');

    console.log('\n✅ All icons generated successfully!');

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
