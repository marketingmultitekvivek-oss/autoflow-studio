# AutoFlow Studio

AutoFlow Studio is a simple browser-based workflow builder for creating reusable browser automation instructions.

Live app: https://marketingmultitekvivek-oss.github.io/autoflow-studio/

The web app itself does not directly control other websites. It helps you build, save, validate, export, and generate Playwright automation code. The generated Playwright code can then run on your own computer.

---

# 1. How AutoFlow works

AutoFlow has four main parts:

1. **Builder** - create the automation steps.
2. **Batch data** - load CSV data and use columns as variables.
3. **Runner code** - generate Playwright JavaScript.
4. **How it works** - short built-in help.

Basic flow:

```text
Create workflow
      ↓
Add steps
      ↓
Replace changing values with {{variables}}
      ↓
Optional: load CSV
      ↓
Dry run / validate
      ↓
Open Runner code
      ↓
Download .js
      ↓
Run with Playwright on your computer
```

---

# 2. Open AutoFlow Studio

Open:

https://marketingmultitekvivek-oss.github.io/autoflow-studio/

The page has three main areas:

- Left side: **Workflows**
- Top middle: **Workflow name** and action buttons
- Main area: **Builder / Batch data / Runner code / How it works**

---

# 3. Top buttons

## New workflow

Creates a new empty workflow.

Use this when you want to make a completely new automation.

Example:

```text
Update Blogger Meta Description
```

---

## Import JSON

Loads a workflow that you previously exported from AutoFlow.

Use this when:

- you moved to another computer
- you want to restore a saved workflow
- someone shared an AutoFlow workflow with you

Accepted format:

```text
.autoflow.json
.json
```

---

## Export JSON

Downloads the current workflow as a portable AutoFlow file.

The exported file can include:

- workflow name
- workflow steps
- CSV rows
- global variables

This is useful for backup and sharing.

---

# 4. Workflows panel

The left panel shows all workflows stored in your browser.

Example:

```text
Workflows

Update Blogger Post
Test Form Automation
SEO Metadata Workflow
```

Click a workflow name to open it.

Click the **×** button next to a workflow to delete it.

Important: workflows are saved in your browser's local storage. Clearing browser site data can remove them, so export important workflows as JSON.

---

# 5. Workflow name field

Field:

```text
Workflow name
```

Enter a clear name that describes the job.

Good examples:

```text
Update Blogger Meta Description
Submit Contact Form
Check Article Preview
Batch Edit Product Titles
```

Avoid names such as:

```text
Test
Workflow 1
New workflow
```

A good name makes it easier to understand what the automation does later.

---

# 6. Save button

Click **Save** after editing a workflow.

This stores the workflow in your browser.

You should save after:

- adding steps
- editing steps
- changing variables
- changing the workflow name

---

# 7. Dry run / validate

Click:

```text
Dry run / validate
```

This checks the workflow configuration without running the target website automation.

It checks for common problems such as:

- missing URL
- missing selector
- missing visible text
- unknown CSV variable
- risky action without confirmation

Example result:

```text
Validation passed
No obvious configuration problems were found.
```

Or:

```text
2 items to review

Step 2: no locator is defined.
Step 5: risky-looking click should require confirmation.
```

Fix validation warnings before generating your final runner.

---

# 8. Builder tab

The Builder tab is where you create the automation step by step.

Available step types:

```text
Navigate
Click
Type
Select
Wait for
Wait
Confirm
```

Each step is explained below.

---

# 9. Navigate field

Use **Navigate** when the automation should open a website or page.

Field:

```text
URL
```

Example:

```text
https://www.selenium.dev/selenium/web/web-form.html
```

You can also use a variable:

```text
{{url}}
```

This is useful when your CSV contains a different URL for each row.

Example CSV:

```csv
url
https://example.com/page-1
https://example.com/page-2
```

---

# 10. Click step

Use **Click** when the automation should press a button, link, menu item, checkbox, or another clickable element.

AutoFlow provides three ways to identify the element.

## Visible text

Field:

```text
Visible text
```

Example:

```text
Submit
```

AutoFlow generates code similar to:

```javascript
page.getByText("Submit", { exact: true })
```

Use visible text when the button or link has clear text.

Examples:

```text
Edit
Preview
Save
Next
Submit
```

---

## ARIA label

Field:

```text
ARIA label
```

This is useful for buttons that use accessibility labels instead of visible text.

Example HTML:

```html
<button aria-label="Open settings">...</button>
```

Enter:

```text
Open settings
```

---

## CSS selector

Field:

```text
CSS selector
```

Use this when visible text or ARIA label is not enough.

Examples:

```css
#submit
button.publish
input[name="title"]
textarea[name="description"]
```

For beginners, try **Visible text** first.

Use CSS selectors only when necessary.

---

# 11. Require manual confirmation

Inside a Click step you can enable:

```text
Require manual confirmation
```

Use this for actions that should not happen automatically.

Examples:

```text
Publish
Delete
Send
Purchase
Pay
Approve
Remove
Submit final form
```

When enabled, the generated runner asks you to confirm before clicking.

Example:

```text
Confirm click: Publish
Type YES to continue:
```

The click only happens after you enter:

```text
YES
```

---

# 12. Type step

Use **Type** when the automation should enter text into a field.

You need two things:

1. the field locator
2. the text value

Example selector:

```css
input[name="title"]
```

Value:

```text
My Article Title
```

Or use a variable:

```text
{{article_title}}
```

Example CSV:

```csv
article_title
Caliper Calibration Guide
Micrometer Calibration Guide
```

For each CSV row, AutoFlow replaces:

```text
{{article_title}}
```

with the value from that row.

---

# 13. Select step

Use **Select** for a normal HTML dropdown.

Example selector:

```css
select[name="country"]
```

Example value:

```text
IN
```

This generates Playwright code similar to:

```javascript
await page.locator('select[name="country"]').selectOption("IN");
```

Important: the value may be different from the text shown to the user.

Example HTML:

```html
<option value="IN">India</option>
```

The correct value is:

```text
IN
```

not:

```text
India
```

unless the website uses `India` as the option value.

---

# 14. Wait for step

Use **Wait for** when AutoFlow should wait until an element appears.

This is useful for dynamic websites.

Example:

```text
Wait for: Edit
Timeout: 10000
```

The timeout is in milliseconds.

Common values:

```text
5000  = 5 seconds
10000 = 10 seconds
20000 = 20 seconds
```

Example workflow:

```text
Navigate
↓
Wait for "Edit"
↓
Click "Edit"
```

This is usually more reliable than using only a fixed Wait step.

---

# 15. Wait step

Use **Wait** to pause for a fixed amount of time.

Field:

```text
Milliseconds
```

Examples:

```text
500  = 0.5 second
1000 = 1 second
2000 = 2 seconds
5000 = 5 seconds
```

Use Wait when the page needs a short pause after an action.

Example:

```text
Click Save
↓
Wait 1500 ms
↓
Click Preview
```

For waiting for a specific button or field to appear, prefer **Wait for**.

---

# 16. Confirm step

Use **Confirm** to pause the automation and require your approval.

Field:

```text
Confirmation message
```

Example:

```text
Check the article preview. Continue to publish?
```

Generated runner behavior:

```text
Check the article preview. Continue to publish?
Type YES to continue:
```

This is useful before:

- publishing content
- deleting data
- sending messages
- submitting payments
- changing account settings

---

# 17. Reorder steps

Every workflow step has:

```text
↑
↓
Edit
×
```

Use:

- **↑** to move the step up
- **↓** to move the step down
- **Edit** to change the step
- **×** to remove the step

Automation runs from the first step to the last step.

Example:

```text
1 Navigate
2 Wait for
3 Click
4 Type
5 Confirm
6 Click Publish
```

---

# 18. Advanced JSON

When editing a step, open:

```text
Advanced JSON
```

This shows the raw AutoFlow step.

Example:

```json
{
  "action": "type",
  "locator": {
    "css": "input[name='title']"
  },
  "value": "{{article_title}}"
}
```

Most beginners do not need to edit this manually.

It is useful for advanced customization and troubleshooting.

---

# 19. Batch data tab

Open:

```text
Batch data
```

This lets you run the same workflow with different data.

Example CSV:

```csv
url,article_title,meta_description
https://example.com/post-1,Title One,Description One
https://example.com/post-2,Title Two,Description Two
```

AutoFlow automatically creates variables from the column names:

```text
{{url}}
{{article_title}}
{{meta_description}}
```

---

# 20. Load CSV

Click:

```text
Load CSV
```

Choose a CSV file from your computer.

AutoFlow shows:

- number of rows
- number of columns
- available variables
- first 10 rows as a preview

Example:

```text
2 rows
3 columns

Variables:
{{url}}
{{article_title}}
{{meta_description}}
```

---

# 21. Download sample CSV

Click:

```text
Download sample CSV
```

AutoFlow downloads an example file.

You can open it in:

- Microsoft Excel
- LibreOffice Calc
- Google Sheets

Edit the rows, save as CSV, then load it back into AutoFlow.

---

# 22. Clear CSV

Click:

```text
Clear CSV
```

This removes the currently loaded batch data from AutoFlow.

It does not delete the CSV file from your computer.

---

# 23. Global variables

Field:

```text
Global variables
```

Use JSON format.

Example:

```json
{
  "site": "Blogger",
  "author": "Vivek"
}
```

You can then use:

```text
{{site}}
{{author}}
```

inside workflow steps.

Global variables are useful when the same value should be used for every CSV row.

CSV values override global variables if both use the same key.

---

# 24. Variables

Variables are written using double curly brackets.

Example:

```text
{{article_title}}
```

If your CSV contains:

```csv
article_title
Caliper Calibration Guide
```

then:

```text
{{article_title}}
```

becomes:

```text
Caliper Calibration Guide
```

during the automation run.

Variable names should match CSV column names exactly.

---

# 25. Runner code tab

Open:

```text
Runner code
```

AutoFlow converts your workflow into Playwright JavaScript.

Example:

```javascript
await page.goto("https://example.com");

await page
  .locator('input[name="title"]')
  .fill("Example title");

await page
  .getByText("Submit", { exact: true })
  .click();
```

This is the code that performs the real browser automation.

---

# 26. Copy button

Click:

```text
Copy
```

The generated Playwright code is copied to your clipboard.

Use this when you want to paste the code into:

- VS Code
- Notepad
- another development tool
- a Playwright project

---

# 27. Download .js

Click:

```text
Download .js
```

AutoFlow downloads the generated automation script.

Example filename:

```text
update-blogger-post.js
```

This can be run on your computer with Node.js and Playwright.

---

# 28. Install Playwright

Install Node.js first.

Then create a folder and open a terminal in that folder.

Run:

```bash
npm init -y
npm install playwright
npx playwright install chromium
```

Place the downloaded AutoFlow `.js` file in that folder.

---

# 29. Run your automation

Run:

```bash
node your-workflow.js
```

Example:

```bash
node update-blogger-post.js
```

Chromium opens and follows the workflow.

If the workflow contains a Confirm step, return to the terminal and type:

```text
YES
```

to continue.

---

# 30. Simple test example

A good first test uses the Selenium demo form:

https://www.selenium.dev/selenium/web/web-form.html

Create this workflow:

```text
1. Navigate
   https://www.selenium.dev/selenium/web/web-form.html

2. Wait for
   CSS selector:
   input[name="my-text"]

3. Type
   CSS selector:
   input[name="my-text"]

   Value:
   Hello from AutoFlow

4. Confirm
   Message:
   Check the form before submitting.

5. Click
   Visible text:
   Submit
```

Then:

```text
Save
↓
Dry run / validate
↓
Runner code
↓
Download .js
↓
Run with Node.js
```

---

# 31. Batch example

CSV:

```csv
url,name,message
https://example.com/form,John,Hello John
https://example.com/form,Mary,Hello Mary
```

Workflow:

```text
Navigate → {{url}}

Type → {{name}}

Type → {{message}}

Confirm

Click Submit
```

The generated Playwright runner processes each row one after another.

---

# 32. Blogger-style example

Possible workflow:

```text
Navigate → {{url}}
↓
Wait for Edit
↓
Click Edit
↓
Type {{article_title}}
↓
Type {{meta_description}}
↓
Click Preview
↓
Confirm
↓
Click Publish
```

CSV:

```csv
url,article_title,meta_description
POST_URL_1,Caliper Calibration Guide,Caliper calibration procedure and guidance
POST_URL_2,Micrometer Calibration Guide,Micrometer calibration procedure and uncertainty
```

The exact selectors depend on the website and may need to be adjusted.

---

# 33. Load sample

Click:

```text
Load sample
```

AutoFlow creates a sample workflow and sample CSV data.

Use it to understand how:

- workflow steps
- variables
- confirmation
- CSV rows

work together.

You can edit or delete the sample afterward.

---

# 34. Clear local data

Click:

```text
Clear local data
```

This removes AutoFlow workflows and CSV data stored in your browser.

Use carefully.

Before clearing data, export important workflows as JSON.

---

# 35. What AutoFlow can do

AutoFlow can help build browser automation for tasks such as:

- repetitive form filling
- page navigation
- text entry
- dropdown selection
- batch processing from CSV
- generating Playwright automation
- content management workflows
- QA testing
- admin task automation

---

# 36. What the GitHub Pages web app cannot do by itself

A normal GitHub Pages website cannot directly control arbitrary websites in your browser.

For security reasons, the hosted AutoFlow page cannot simply open Blogger, GitHub, Gmail, or another site and start clicking inside those tabs.

That is why AutoFlow generates Playwright code.

The architecture is:

```text
AutoFlow Studio
      ↓
Workflow definition
      ↓
Playwright JavaScript
      ↓
Your local computer
      ↓
Chromium
      ↓
Target website
```

---

# 37. Safety recommendations

Do not place passwords, API keys, payment details, or other secrets inside workflow JSON or CSV files.

Use Confirm before actions such as:

```text
Publish
Delete
Send
Purchase
Pay
Approve
Remove
Account changes
```

Test new workflows on non-critical pages first.

Always review a batch file before running many rows.

---

# 38. Troubleshooting

## Button not found

Try another locator.

Instead of:

```text
Visible text
```

try:

```text
ARIA label
```

or:

```text
CSS selector
```

---

## Page loads slowly

Add:

```text
Wait for
```

before clicking the next element.

---

## Variable not replaced

Check that the variable name exactly matches the CSV column.

Example:

CSV:

```text
article_title
```

Correct:

```text
{{article_title}}
```

Incorrect:

```text
{{ArticleTitle}}
```

---

## Playwright says module not found

Run:

```bash
npm install playwright
```

Then:

```bash
npx playwright install chromium
```

---

## Workflow works on one page but not another

The website may use different selectors.

Inspect the target field or button and update the AutoFlow locator.

---

# 39. Recommended beginner workflow

Start small.

Build:

```text
Navigate
↓
Wait for
↓
Type
↓
Confirm
↓
Click
```

Once that works, add:

```text
CSV batch data
Variables
More fields
Multiple pages
```

This makes troubleshooting much easier.

---

# 40. Project files

The repository contains:

```text
index.html
app.js
styles.css
manifest.webmanifest
sw.js
.nojekyll
.github/workflows/deploy-pages.yml
README.md
```

GitHub Pages deployment is handled by:

```text
.github/workflows/deploy-pages.yml
```

---

# 41. Live project

AutoFlow Studio:

https://marketingmultitekvivek-oss.github.io/autoflow-studio/

GitHub repository:

https://github.com/marketingmultitekvivek-oss/autoflow-studio
