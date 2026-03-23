---
name: generate-cat-asset
description: Use when the user requests a cat game asset by specifying a cat type and shape, e.g. "black, chonk shaped cat" or "orange L cat". Generates 5 prompt variants and calls nano banana.
---

# Generate Cat Asset

Parse the user's request for a **cat type** and **shape**, then output **5 prompt variants** and call `mcp__nanobanana__generate_image`.

## Cat Types

| Type | Color Name | Color Hex | Markings | Eyes |
|------|-----------|-----------|----------|------|
| orange | orange | #E8875A | subtle darker orange tabby stripes | small dot eyes |
| black | dark charcoal-black | #2A2A3A | subtle sheen highlights on dark fur | small bright dot eyes |
| white | light white | #B0B8D0 | subtle blue-grey shading on white fur | small dot eyes |
| grey | blue-grey | #6878A0 | subtle darker grey markings | small dot eyes |
| tabby | warm brown | #A07040 | classic dark brown tabby stripes and M-shaped forehead marking | small dot eyes |

## Shape Data

Each shape has: grid layout, cell coordinates, poses, quirky poses, and body-part-to-cell mapping for precise prompts.

### uno (1 cell)
- **Grid**: `■`
- **Aspect**: 1:1
- **Pose**: sitting upright, compact round pose
- **Alt pose**: curled into a tight sleeping ball, tucked paws and tail wrapped around
- **Quirky**: grumpy loaf with half-closed judgmental eyes and a flat unimpressed expression
- **Quirky alt**: sitting with one eyebrow raised, looking at something stupid with pure contempt
- **Body map**: The cat sits compactly in the single square, fully contained, round body filling the cell edge-to-edge

### duo (1x2 horizontal)
- **Grid**: `■ ■`
- **Aspect**: 3:2
- **Pose**: lying on side, slightly stretched
- **Alt pose**: sitting upright with tail extended straight out behind
- **Quirky**: lazy cat flopped on its side like it just gave up on life, one paw dangling pathetically
- **Quirky alt**: lying flat refusing to move, dead-eyed stare into the void, existential crisis energy
- **Body map**: Head and front paws in the left square, haunches and tail in the right square. The cat's body spans both cells horizontally

### trio (1x3 horizontal)
- **Grid**: `■ ■ ■`
- **Aspect**: 3:2
- **Pose**: long stretch, loaf position
- **Alt pose**: stalking forward in a low crouch, body stretched in a line
- **Quirky**: smug cat doing an exaggerated slow walk with its nose in the air, total diva energy
- **Quirky alt**: sauntering away from something it definitely broke, tail high, zero remorse
- **Body map**: Head in the left square, torso in the center square, haunches and tail in the right square. Horizontal line of 3 equal cells

### corner (3-cell small L)
- **Grid**: `■ ■` / `· ■`
- **Cells**: (0,0) (0,1) top row; (1,1) bottom row
- **Aspect**: 1:1
- **Pose**: curled up in a tight corner curl
- **Alt pose**: sitting upright with tail wrapped neatly around to one side
- **Quirky**: suspicious cat peeking around a corner with one eye narrowed, clearly plotting something devious
- **Quirky alt**: hunched in a corner pretending to be invisible after getting caught doing something bad
- **Body map**: Head in top-left square, front body in top-right square, haunches and tail curl down into bottom-right square. Top-left-to-bottom-right is empty

### straight (1x4 horizontal)
- **Grid**: `■ ■ ■ ■`
- **Aspect**: 3:2
- **Pose**: full elongated stretch on side
- **Alt pose**: mid-leap, body fully stretched out horizontally in the air
- **Quirky**: cat mid-zoomie in a completely unhinged horizontal sprint, legs a blur of chaos
- **Quirky alt**: stretched impossibly long like taffy, reaching for food on a counter
- **Body map**: Head in far-left square, front legs in second square, torso in third square, back legs and tail in far-right square. 4 cells in a horizontal line

### L (4-cell L)
- **Grid**: `■ ·` / `■ ·` / `■ ■`
- **Cells**: (0,0) (1,0) (2,0) left column; (2,1) bottom-right
- **Aspect**: 1:1
- **Pose**: lounging with back legs extended to one side
- **Alt pose**: sitting tall with tail curling along the ground to one side
- **Quirky**: sitting upright but with legs awkwardly splayed to one side like it forgot how to sit
- **Quirky alt**: casually grooming in an L-shaped contortion, leg behind its head, acting normal
- **Body map**: Head in top-left square, chest in middle-left square, haunches in bottom-left square, tail extends right into bottom-right square. Vertical body with tail kicking right at the bottom

### J (4-cell J, mirror L)
- **Grid**: `· ■` / `· ■` / `■ ■`
- **Cells**: (0,1) (1,1) right column; (2,0) bottom-left
- **Aspect**: 1:1
- **Pose**: lounging with back legs extended to the opposite side
- **Alt pose**: sitting tall with tail curling along the ground to the opposite side
- **Quirky**: startled cat that just knocked something off a table, legs going the wrong direction
- **Quirky alt**: sitting backwards on purpose, staring at you over its shoulder with attitude
- **Body map**: Head in top-right square, chest in middle-right square, haunches in bottom-right square, tail extends left into bottom-left square. Vertical body with tail kicking left at the bottom

### Z (4-cell Z)
- **Grid**: `■ ■ ·` / `· ■ ■`
- **Cells**: (0,0) (0,1) top row; (1,1) (1,2) bottom row
- **Aspect**: 3:2
- **Pose**: twisted playful roll, body zigzagging
- **Alt pose**: mid-pounce with body twisting in a zigzag
- **Quirky**: tangled in its own body mid-grooming, twisted into an absurd pretzel
- **Quirky alt**: fell asleep in a ridiculous twisted position and is somehow comfortable
- **Body map**: Head and front paws in top-left square, chest twists through top-center square, haunches shift into bottom-center square, back legs and tail in bottom-right square. Top-right and bottom-left are empty and transparent

### S (4-cell S, mirror Z)
- **Grid**: `· ■ ■` / `■ ■ ·`
- **Cells**: (0,1) (0,2) top row; (1,0) (1,1) bottom row
- **Aspect**: 3:2
- **Pose**: twisted playful roll, mirrored zigzag
- **Alt pose**: slinky walk with body curving in an S-shape
- **Quirky**: sneaky cat slinking away from a crime scene, body curved guiltily
- **Quirky alt**: doing an exaggerated Halloween arch with maximum sass, body curved dramatically
- **Body map**: Head and front paws in top-center square, chest in top-right square, haunches shift into bottom-center square, back legs and tail in bottom-left square. Top-left and bottom-right are empty and transparent

### T (4-cell T)
- **Grid**: `■ ■ ■` / `· ■ ·`
- **Cells**: (0,0) (0,1) (0,2) top row; (1,1) bottom-center
- **Aspect**: 1:1
- **Pose**: sprawled on back, legs spread in T formation
- **Alt pose**: sitting proudly with both front paws stretched straight out in front
- **Quirky**: dramatic cat lying on its back demanding belly rubs with all limbs out, total drama queen
- **Quirky alt**: doing a theatrical faint, pretending to die because dinner is five minutes late
- **Body map**: Left paw extends into top-left square, head and chest in top-center square, right paw extends into top-right square, haunches and tail hang down into bottom-center square

### chonk (2x2 square)
- **Grid**: `■ ■` / `■ ■`
- **Aspect**: 1:1
- **Pose**: chunky round sitting cat, very plump and compact
- **Alt pose**: curled up asleep in a plump round ball, face tucked in
- **Quirky**: absolute unit, impossibly round, smug about its size, no regrets
- **Quirky alt**: spherical cat that has clearly been eating too well, sitting like a bowling ball with tiny legs
- **Body map**: Head in top-left, front body in top-right, lower body in bottom-left, haunches and tail in bottom-right. Cat fills all 4 squares as a fat round blob

### cross (5-cell plus)
- **Grid**: `· ■ ·` / `■ ■ ■` / `· ■ ·`
- **Cells**: (0,1) top; (1,0) (1,1) (1,2) middle row; (2,1) bottom
- **Aspect**: 1:1
- **Pose**: full belly-up sprawl, all four legs and tail out
- **Alt pose**: big stretch with a yawn, all four limbs extended outward
- **Quirky**: startled cat with all four legs and tail puffed out in surprise, full starfish panic
- **Quirky alt**: just saw a cucumber, all limbs extended in every direction in pure terror
- **Body map**: Top of head/ears in top-center square, left paw in middle-left, body center in middle-center, right paw in middle-right, tail/back legs in bottom-center. Corners are all empty and transparent

### chonker (5-cell chunky L)
- **Grid**: `■ ■` / `■ ■` / `■ ·`
- **Cells**: (0,0) (0,1) (1,0) (1,1) (2,0)
- **Aspect**: 1:1
- **Pose**: big chunky cat lounging heavily
- **Alt pose**: hefty cat sitting upright with a round belly and tail wrapping around
- **Quirky**: thicc cat that got stuck trying to fit somewhere too small, belly hanging out
- **Quirky alt**: wedged halfway through a cat flap, front half through, back half stuck
- **Body map**: Head in top-left, front shoulder in top-right, chest in middle-left, belly in middle-right, haunches and tail in bottom-left. Bottom-right is empty and transparent

### chonkest (2x3 rectangle)
- **Grid**: `■ ■ ■` / `■ ■ ■`
- **Aspect**: 3:2
- **Pose**: maximum sprawl, large lazy cat taking up space
- **Alt pose**: sleeping flat on its side, totally relaxed, legs dangling
- **Quirky**: melted into a boneless puddle blob, taking up maximum space with zero dignity
- **Quirky alt**: sprawled out like a pancake hogging an entire couch, daring anyone to move it
- **Body map**: Head in top-left, front paws in top-center, chest in top-right, belly in bottom-left, haunches in bottom-center, tail in bottom-right. Cat fills all 6 cells as a huge lazy blob

## 5 Prompt Templates

For each request, output ALL 5 variants:

### 1. Normal
```
A cute minimalist illustration of a {COLOR_NAME} cat in a {POSE}. The cat's body naturally forms a {SHAPE} silhouette. Hand-drawn whimsical style like a stamp print, {HEX} colored silhouette with {MARKINGS}. Simple features: pointy ears, {EYES}, tiny nose. Clean lines, transparent background. Cozy, charming game asset illustration.
```

### 2. Alternative Pose
```
A cute minimalist illustration of a {COLOR_NAME} cat {ALT_POSE}. The cat's body naturally forms a {SHAPE} silhouette. Hand-drawn whimsical style like a stamp print, {HEX} colored silhouette with {MARKINGS}. Simple features: pointy ears, {EYES}, tiny nose. Clean lines, transparent background. Cozy, charming game asset illustration.
```

### 3. Quirky
```
A minimalist illustration of a {COLOR_NAME} cat {QUIRKY_POSE}. The cat's body naturally forms a {SHAPE} silhouette. Hand-drawn whimsical style like a stamp print, {HEX} colored silhouette with {MARKINGS}. {QUIRKY_EXPRESSION}, pointy ears, {EYES}. Clean lines, transparent background. Sarcastic game asset illustration.
```

### 4. Quirky Alternative
```
A minimalist illustration of a {COLOR_NAME} cat {QUIRKY_ALT_POSE}. The cat's body naturally forms a {SHAPE} silhouette. Hand-drawn whimsical style like a stamp print, {HEX} colored silhouette with {MARKINGS}. {QUIRKY_ALT_EXPRESSION}, pointy ears, {EYES}. Clean lines, transparent background. Sarcastic game asset illustration.
```

### 5. Precise Shape (top-down, body-part-to-cell mapping)
```
A minimalist illustration of a {COLOR_NAME} cat viewed from above, fitting precisely within a {SHAPE}-shaped tetromino on a {GRID_DIMS} grid. The grid layout is: {GRID_ASCII}. Filled squares: {CELL_LIST}. Empty squares are transparent. {BODY_MAP}. Each square is equal-sized. The cat is a {HEX} {COLOR_NAME} flat colored silhouette with {MARKINGS}, drawn in a hand-drawn stamp print style. The cat's body fills the filled squares edge-to-edge with no gaps and does NOT extend into the empty squares. Transparent background. Top-down perspective. Clean lines, no grid outlines.
```

## Tool Call Parameters

- **prompt**: Use the selected variant template
- **aspect_ratio**: From shape data
- **negative_prompt**: `realistic, photographic, 3D render, text, watermark, complex background, detailed shading, gradient background` (add `cute, kawaii, chibi, big eyes` for quirky variants)
- **output_path**: `{project}/assets/cat-{type}-{shape}-{variant}.png` where variant = `normal`, `alt`, `quirky`, `quirky-alt`, `precise`
- **input_image_path_1**: `{project}/cat_reference.png` (style reference)
- **model_tier**: `nb2`

Where `{project}` = `C:/Users/laurus/laurus/Projects/PurrfectFitDemo`

## Workflow

1. Parse cat type and shape from user message
2. Look up all data from Cat Types and Shape Data tables
3. Output all 5 prompt variants as formatted text so user can review
4. Call `mcp__nanobanana__generate_image` with user's preferred variant (or all 5 if requested)
