using System.Text.Json;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using W = DocumentFormat.OpenXml.Wordprocessing;

if (args.Length < 2)
{
    Console.Error.WriteLine("Usage: OpenXmlSidecar <input-json> <output-docx>");
    return 2;
}

var inputPath = args[0];
var outputPath = args[1];
var json = await File.ReadAllTextAsync(inputPath);
using var doc = JsonDocument.Parse(json);
var root = doc.RootElement;
var intermediate = root.GetProperty("intermediate");
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(outputPath))!);
if (File.Exists(outputPath)) File.Delete(outputPath);

using var wordDocument = WordprocessingDocument.Create(outputPath, WordprocessingDocumentType.Document);
var mainPart = wordDocument.AddMainDocumentPart();
mainPart.Document = new W.Document(new W.Body());
AddStyles(mainPart);
AddNumbering(mainPart);
var body = mainPart.Document.Body!;

foreach (var block in intermediate.GetProperty("blocks").EnumerateArray())
{
    var type = block.GetProperty("type").GetString();
    switch (type)
    {
        case "documentTitle":
            body.Append(CreateParagraph(block.GetProperty("text").GetString() ?? "", "Title"));
            break;
        case "heading":
            var level = block.GetProperty("level").GetInt32();
            body.Append(CreateParagraph(block.GetProperty("text").GetString() ?? "", level <= 1 ? "Heading1" : "Heading2"));
            break;
        case "paragraph":
            body.Append(CreateParagraph(block.GetProperty("text").GetString() ?? "", null));
            break;
        case "list":
            var ordered = block.GetProperty("ordered").GetBoolean();
            foreach (var item in block.GetProperty("items").EnumerateArray())
            {
                body.Append(CreateListParagraph(item.GetString() ?? "", ordered ? 1 : 2));
            }
            break;
        case "table":
            body.Append(CreateTable(block));
            break;
    }
}

body.Append(new W.SectionProperties(
    new W.PageSize { Width = 11906, Height = 16838 },
    new W.PageMargin { Top = 1440, Right = 1440, Bottom = 1440, Left = 1440 }
));
mainPart.Document.Save();
return 0;

static W.Paragraph CreateParagraph(string text, string? style)
{
    var paragraphProperties = new W.ParagraphProperties();
    if (!string.IsNullOrWhiteSpace(style)) paragraphProperties.Append(new W.ParagraphStyleId { Val = style });
    return new W.Paragraph(
        paragraphProperties,
        new W.Run(new W.RunProperties(new W.RunFonts { Ascii = "FangSong", HighAnsi = "FangSong", EastAsia = "FangSong" }, new W.FontSize { Val = "31" }), new W.Text(text) { Space = SpaceProcessingModeValues.Preserve })
    );
}

static W.Paragraph CreateListParagraph(string text, int numberingId)
{
    return new W.Paragraph(
        new W.ParagraphProperties(
            new W.NumberingProperties(new W.NumberingLevelReference { Val = 0 }, new W.NumberingId { Val = numberingId })
        ),
        new W.Run(new W.Text(text) { Space = SpaceProcessingModeValues.Preserve })
    );
}

static W.Table CreateTable(JsonElement block)
{
    var rows = new List<W.TableRow>();
    rows.Add(new W.TableRow(block.GetProperty("columns").EnumerateArray().Select(column => CreateCell(column.GetString() ?? ""))));
    foreach (var row in block.GetProperty("rows").EnumerateArray())
    {
        rows.Add(new W.TableRow(row.EnumerateArray().Select(cell => CreateCell(cell.GetString() ?? ""))));
    }
    var table = new W.Table(
        new W.TableProperties(
            new W.TableWidth { Width = "5000", Type = W.TableWidthUnitValues.Pct },
            new W.TableBorders(
                new W.TopBorder { Val = W.BorderValues.Single, Size = 4 },
                new W.BottomBorder { Val = W.BorderValues.Single, Size = 4 },
                new W.LeftBorder { Val = W.BorderValues.Single, Size = 4 },
                new W.RightBorder { Val = W.BorderValues.Single, Size = 4 },
                new W.InsideHorizontalBorder { Val = W.BorderValues.Single, Size = 4 },
                new W.InsideVerticalBorder { Val = W.BorderValues.Single, Size = 4 }
            )
        )
    );
    table.Append(rows);
    return table;
}

static W.TableCell CreateCell(string text)
{
    return new W.TableCell(new W.Paragraph(new W.Run(new W.Text(text) { Space = SpaceProcessingModeValues.Preserve })));
}

static void AddStyles(MainDocumentPart mainPart)
{
    var stylesPart = mainPart.AddNewPart<StyleDefinitionsPart>();
    stylesPart.Styles = new W.Styles(
        CreateParagraphStyle("Title", "Title", "44", true),
        CreateParagraphStyle("Heading1", "Heading 1", "32", true),
        CreateParagraphStyle("Heading2", "Heading 2", "31", true)
    );
    stylesPart.Styles.Save();
}

static W.Style CreateParagraphStyle(string id, string name, string size, bool bold)
{
    var runProperties = new W.StyleRunProperties(new W.RunFonts { Ascii = "FangSong", HighAnsi = "FangSong", EastAsia = "FangSong" }, new W.FontSize { Val = size });
    if (bold) runProperties.Append(new W.Bold());
    return new W.Style(new W.Name { Val = name }, new W.BasedOn { Val = "Normal" }, new W.NextParagraphStyle { Val = "Normal" }, runProperties)
    {
        Type = W.StyleValues.Paragraph,
        StyleId = id,
        CustomStyle = false,
    };
}

static void AddNumbering(MainDocumentPart mainPart)
{
    var numberingPart = mainPart.AddNewPart<NumberingDefinitionsPart>();
    numberingPart.Numbering = new W.Numbering(
        new W.AbstractNum(
            new W.Level(new W.StartNumberingValue { Val = 1 }, new W.NumberingFormat { Val = W.NumberFormatValues.Decimal }, new W.LevelText { Val = "%1." }) { LevelIndex = 0 }
        ) { AbstractNumberId = 1 },
        new W.NumberingInstance(new W.AbstractNumId { Val = 1 }) { NumberID = 1 },
        new W.AbstractNum(
            new W.Level(new W.StartNumberingValue { Val = 1 }, new W.NumberingFormat { Val = W.NumberFormatValues.Bullet }, new W.LevelText { Val = "•" }) { LevelIndex = 0 }
        ) { AbstractNumberId = 2 },
        new W.NumberingInstance(new W.AbstractNumId { Val = 2 }) { NumberID = 2 }
    );
    numberingPart.Numbering.Save();
}
