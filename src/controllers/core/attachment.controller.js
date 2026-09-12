const attachmentService = require("../../services/taskAttachment.service");
const ApiError = require("../../utils/ApiError");

const ok = (res, data, status = 200) => res.status(status).json(data);

exports.upload = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    if (!req.file) throw new ApiError(400, "No file provided");
    const attachment = await attachmentService.uploadAttachment({
      tenantId,
      taskId: req.params.taskId,
      file: {
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      uploadedBy: req.user._id,
      isPublic: req.body.isPublic !== "false",
      description: req.body.description || "",
    });
    ok(res, attachment, 201);
  } catch (err) {
    next(err);
  }
};

exports.list = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const attachments = await attachmentService.listAttachments(
      req.params.taskId,
      tenantId,
      {
        includeDeleted: req.query.includeDeleted === "true",
      },
    );
    ok(res, attachments);
  } catch (err) {
    next(err);
  }
};

exports.download = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    const { filePath, attachment } = await attachmentService.getDownloadPath(
      req.params.id,
      tenantId,
    );
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(attachment.originalName)}"`,
    );
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const tenantId = req.user?.company || req.companyId;
    await attachmentService.softDeleteAttachment(
      req.params.id,
      tenantId,
      req.user._id,
    );
    ok(res, { message: "Attachment deleted" });
  } catch (err) {
    next(err);
  }
};
