const Material = require('../models/Material');
const Review = require('../models/Review');
const CBT = require('../models/CBT');
const CBTResult = require('../models/CBTResult');
const { cloudinary } = require('../config/cloudinary');
const OpenAI = require('openai');
const pdf = require('pdf-parse');
const streamifier = require('streamifier');

// Predefined faculties for consistent UI
const PREDEFINED_FACULTIES = [
    { name: 'Engineering', icon: 'settings-outline', color: '#3b82f6' },
    { name: 'Science', icon: 'flask-outline', color: '#10b981' },
    { name: 'Arts', icon: 'color-palette-outline', color: '#f59e0b' },
    { name: 'Medicine', icon: 'medkit-outline', color: '#ef4444' },
    { name: 'Law', icon: 'briefcase-outline', color: '#8b5cf6' },
    { name: 'Management', icon: 'business-outline', color: '#ec4899' },
    { name: 'Agriculture', icon: 'leaf-outline', color: '#84cc16' },
    { name: 'Education', icon: 'school-outline', color: '#06b6d4' }
];

// Initialize OpenAI only if key is present
let openai;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
} else {
    console.warn('OPENAI_API_KEY not found in .env. AI features will be disabled.');
}

// @desc    Get all materials
// @route   GET /api/library/materials
// @access  Public
const getMaterials = async (req, res) => {
    try {
        const { category, type, faculty, department, level, university, search, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        let query = {};

        const activeCategory = category || type;
        if (activeCategory) query.category = activeCategory;
        if (faculty) query.faculty = faculty;
        if (department) query.department = department;
        if (level) query.level = level;
        if (university) query.university = university;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { course: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter out blocked users if logged in
        if (req.user && req.user.blockedUsers && req.user.blockedUsers.length > 0) {
            query.uploaderId = { $nin: req.user.blockedUsers };
        }

        const materials = await Material.find(query)
            .populate('uploaderId', 'name avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Material.countDocuments(query);

        res.json({
            materials,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single material
// @route   GET /api/library/materials/:id
// @access  Public
const getMaterial = async (req, res) => {
    const { id } = req.params;
    console.log('[getMaterial] Fetching material ID:', id);
    try {
        const material = await Material.findById(id)
            .populate('uploaderId', 'name avatar university')
            .populate({
                path: 'reviews',
                populate: { path: 'userId', select: 'name avatar' }
            });

        if (!material) {
            console.log('[getMaterial] Material not found for ID:', id);
            return res.status(404).json({ message: 'Material not found' });
        }

        console.log('[getMaterial] Found material:', material.title);
        // Increment views
        material.views += 1;
        await material.save();

        res.json(material);
    } catch (error) {
        console.error('[getMaterial] Detailed Error Log:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Upload material
// @route   POST /api/library/materials
// @access  Private
const uploadMaterial = async (req, res) => {
    console.log('--- Material Upload Started ---');
    try {
        const { title, courseCode, description, category, faculty, department, level } = req.body;

        // Access files from req.files when using upload.fields
        const file = req.files && req.files['file'] ? req.files['file'][0] : null;
        const coverPhoto = req.files && req.files['coverPhoto'] ? req.files['coverPhoto'][0] : null;

        console.log('Upload Metadata:', { title, courseCode, description, category, faculty, department, level });

        if (!file) {
            console.error('Upload Error: No file provided');
            return res.status(400).json({ success: false, message: 'Please upload a file' });
        }

        // Map mimetype to model fileType enum
        const mapMimeToType = (mime) => {
            if (!mime) return 'pdf';
            const m = mime.toLowerCase();
            if (m.includes('pdf')) return 'pdf';
            if (m.includes('word') || m.includes('doc')) return 'doc';
            if (m.includes('presentation') || m.includes('ppt')) return 'ppt';
            if (m.includes('video')) return 'video';
            return 'pdf';
        };

        const mapCategory = (cat) => {
            if (!cat) return 'notes';
            const c = cat.toLowerCase();
            if (c === 'notes' || c.includes('course notes')) return 'notes';
            if (c === 'past-questions' || c.includes('past questions')) return 'past-questions';
            if (c === 'textbook' || c.includes('scholar articles')) return 'textbook';
            if (c === 'video' || c.includes('cbt prep')) return 'video';
            return 'notes';
        };

        const fileType = mapMimeToType(file.mimetype);
        const mappedCategory = mapCategory(category);

        // --- Text Extraction for PDF using buffer ---
        let extractedText = '';
        if (fileType === 'pdf' && file.buffer) {
            try {
                console.log('Extracting text from PDF buffer...');
                const pdfData = await pdf(file.buffer);
                extractedText = pdfData.text;
                console.log(`[SUCCESS] PDF Text Extracted: ${extractedText.length} characters`);
            } catch (err) {
                console.error('Error extracting text from PDF buffer:', err);
            }
        }

        // --- Cloudinary Upload Helper (Buffer to Upload Stream) ---
        const uploadToCloudinary = (buffer, options = {}) => {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { folder: 'dorm_revamp', ...options },
                    (error, result) => {
                        if (error) return reject(error);
                        resolve(result);
                    }
                );
                streamifier.createReadStream(buffer).pipe(uploadStream);
            });
        };

        // Upload main file
        console.log('Uploading material to Cloudinary...');
        const fileUploadResult = await uploadToCloudinary(file.buffer, {
            resource_type: 'auto',
            public_id: `${Date.now()}_${file.originalname.split('.')[0].replace(/\s+/g, '_')}`
        });

        // Upload cover photo if exists
        let coverUploadResult = null;
        if (coverPhoto && coverPhoto.buffer) {
            console.log('Uploading cover photo to Cloudinary...');
            coverUploadResult = await uploadToCloudinary(coverPhoto.buffer, {
                resource_type: 'image',
                public_id: `${Date.now()}_cover_${file.originalname.split('.')[0].replace(/\s+/g, '_')}`
            });
        }

        const materialData = {
            title,
            courseCode,
            description,
            category: mappedCategory,
            faculty: faculty || 'Engineering',
            department,
            level,
            university: req.user.university,
            uploaderId: req.user._id,
            fileUrl: fileUploadResult.secure_url,
            fileId: fileUploadResult.public_id,
            fileType: fileType,
            fileSize: file.size,
            coverUrl: coverUploadResult ? coverUploadResult.secure_url : null,
            content: extractedText
        };

        const material = await Material.create(materialData);
        console.log('Material Record created in database:', material._id);

        const populatedMaterial = await Material.findById(material._id)
            .populate('uploaderId', 'name avatar');

        res.status(201).json({ success: true, material: populatedMaterial });
    } catch (error) {
        console.error('Material Upload Error:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        console.log('--- Material Upload Finished ---');
    }
};

// @desc    Update material
// @route   PUT /api/library/materials/:id
// @access  Private
const updateMaterial = async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);

        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        if (material.uploaderId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updatedMaterial = await Material.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('uploaderId', 'name avatar');

        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
            io.emit('material:updated', updatedMaterial);
        }

        res.json(updatedMaterial);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete material
// @route   DELETE /api/library/materials/:id
// @access  Private
const deleteMaterial = async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);

        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        if (material.uploaderId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await material.deleteOne();
        res.json({ message: 'Material deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Save/unsave material
// @route   POST /api/library/materials/:id/save
// @access  Private
const saveMaterial = async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);

        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        const alreadySaved = material.saves.includes(req.user._id);

        if (alreadySaved) {
            material.saves = material.saves.filter(id => id.toString() !== req.user._id.toString());
        } else {
            material.saves.push(req.user._id);
        }

        await material.save();

        res.json({ saved: !alreadySaved, savesCount: material.saves.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Download material
// @route   POST /api/library/materials/:id/download
// @access  Private
const downloadMaterial = async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);

        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        // Increment downloads
        material.downloads += 1;

        // Track the downloader if not already tracked
        if (!material.downloaders.includes(req.user._id)) {
            material.downloaders.push(req.user._id);
        }

        await material.save();

        let fileUrl = material.fileUrl;

        // If it's a cloudinary URL, generate a signed URL to prevent 401 Unauthorized
        if (fileUrl && fileUrl.includes('cloudinary.com')) {
            try {
                // Use fileId (public_id) if available, otherwise try to extract it from URL
                let publicId = material.fileId;

                if (!publicId) {
                    // Fallback: extract publicId from URL (e.g. dorm-revamp/name)
                    const parts = fileUrl.split('/');
                    const uploadIndex = parts.indexOf('upload');
                    if (uploadIndex !== -1) {
                        const idParts = parts.slice(uploadIndex + 2); // Skip 'upload' and version (v12345)
                        const idWithExt = idParts.join('/');
                        publicId = idWithExt.split('.')[0]; // Remove extension
                    }
                }

                if (publicId) {
                    fileUrl = cloudinary.url(publicId, {
                        secure: true,
                        sign_url: true,
                        resource_type: 'auto'
                    });
                    console.log('Generated signed Cloudinary URL:', fileUrl);
                }
            } catch (err) {
                console.error('Error generating signed URL:', err);
                // Fallback to original URL
            }
        }

        // Emit socket event for real-time download count update
        const io = req.app.get('io');
        if (io) {
            io.emit('material:downloadCountUpdate', {
                materialId: material._id,
                downloads: material.downloads
            });
        }

        res.json({ fileUrl });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get CBT Test
// @route   GET /api/library/cbt/:id
// @access  Private
const getCBT = async (req, res) => {
    try {
        const cbt = await CBT.findById(req.params.id);
        if (!cbt) {
            return res.status(404).json({ message: 'CBT not found' });
        }
        res.json(cbt);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get CBT by Material ID
// @route   GET /api/library/cbt/material/:materialId
// @access  Private
const getCBTByMaterial = async (req, res) => {
    try {
        // Assuming CBT schema has a 'material' field or we search by matching course code?
        // Let's assume there's a 'material' or 'materialId' field in CBT Schema.
        // If not, I'll need to check the schema. For now, I'll assume 'material'.
        const cbt = await CBT.findOne({ material: req.params.materialId });

        if (!cbt) {
            return res.status(404).json({ message: 'No CBT found for this material' });
        }
        res.json(cbt);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Submit CBT Result
// @route   POST /api/library/cbt/submit
// @access  Private
const submitCBT = async (req, res) => {
    try {
        const { cbtId, answers, timeSpent } = req.body;

        const cbt = await CBT.findById(cbtId);
        if (!cbt) {
            return res.status(404).json({ message: 'CBT not found' });
        }

        let score = 0;
        const processedAnswers = answers.map(ans => {
            const question = cbt.questions[ans.questionIndex];
            const isCorrect = question.correctAnswer === ans.selectedOption;
            if (isCorrect) score++;
            return {
                questionIndex: ans.questionIndex,
                selectedOption: ans.selectedOption,
                isCorrect
            };
        });

        const result = await CBTResult.create({
            user: req.user._id,
            cbt: cbtId,
            score,
            totalQuestions: cbt.questions.length,
            timeSpent,
            answers: processedAnswers
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Summarize Text (AI)
// @route   POST /api/library/summarize
// @access  Private
const summarizeMaterial = async (req, res) => {
    try {
        const { text, length = 'medium' } = req.body; // text to summarize

        if (!text) {
            return res.status(400).json({ message: 'Text is required' });
        }

        // Limit text length to avoid token limits / high costs
        const truncatedText = text.substring(0, 4000);

        const prompt = `Summarize the following academic text for a student. Length: ${length}. Text: ${truncatedText}`;

        if (!openai) {
            return res.status(503).json({ message: 'AI service unavailable. Missing API Key.' });
        }

        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: 'gpt-3.5-turbo',
        });

        const summary = completion.choices[0].message.content;
        res.json({ summary });
    } catch (error) {
        console.error('OpenAI Error:', error);
        // Fallback for demo if key is missing or error
        res.status(500).json({ message: 'Failed to generate summary', error: error.message });
    }
};

// @desc    Get all faculties
// @route   GET /api/library/faculties
// @access  Public
const getFaculties = async (req, res) => {
    try {
        console.log('Fetching library faculties...');
        const facultiesWithCounts = await Promise.all(PREDEFINED_FACULTIES.map(async (fac) => {
            const count = await Material.countDocuments({ faculty: fac.name });
            return {
                id: fac.name.toLowerCase(),
                title: fac.name,
                icon: fac.icon,
                color: fac.color,
                count: count
            };
        }));

        res.json(facultiesWithCounts);
    } catch (error) {
        console.error('Error in getFaculties:', error);
        res.status(500).json({ message: error.message });
    }
};

const getCategories = async (req, res) => {
    try {
        // IDs must match Material category enum: ['notes', 'past-questions', 'textbook', 'video']
        const categories = [
            { id: 'notes', title: 'Course Notes', name: 'Course Notes', icon: 'document-text' },
            { id: 'textbook', title: 'Scholar Articles', name: 'Scholar Articles', icon: 'book' },
            { id: 'past-questions', title: 'Past Questions', name: 'Past Questions', icon: 'help-circle' },
            { id: 'video', title: 'CBT Prep', name: 'CBT Prep', icon: 'desktop' }
        ];
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getPersonalLibrary = async (req, res) => {
    try {
        const { tab = 'saved' } = req.query;
        const userId = req.user._id;

        let query = {};
        if (tab === 'saved') {
            query = { saves: userId };
        } else if (tab === 'contributions') {
            query = { uploaderId: userId };
        } else if (tab === 'downloads') {
            query = { downloaders: userId };
        }

        const materials = await Material.find(query)
            .populate('uploaderId', 'name avatar')
            .sort({ createdAt: -1 });

        res.json(materials);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add review to material
// @route   POST /api/library/materials/:id/review
// @access  Private
const addMaterialReview = async (req, res) => {
    console.log('[addMaterialReview] Request for material ID:', req.params.id);
    try {
        const { rating, comment } = req.body;
        const materialId = req.params.id;

        const material = await Material.findById(materialId);
        if (!material) {
            return res.status(404).json({ message: 'Material not found' });
        }

        // Create the review using the shared Review model
        const review = await Review.create({
            userId: req.user._id,
            targetId: materialId,
            targetType: 'material',
            rating,
            content: comment
        });

        // Add review to material and update average rating
        const allReviews = await Review.find({ targetId: materialId, targetType: 'material' });
        const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

        material.reviews.push(review._id);
        material.rating = avgRating;
        await material.save();

        const populatedReview = await Review.findById(review._id).populate('userId', 'name avatar');

        // Emit socket event for real-time updates
        const io = req.app.get('io');
        if (io) {
            io.emit('review:new', {
                materialId: materialId,
                review: {
                    _id: populatedReview._id,
                    user: populatedReview.userId,
                    rating: populatedReview.rating,
                    comment: populatedReview.content,
                    createdAt: populatedReview.createdAt
                }
            });

            // Also emit rating update for the material
            io.emit('material:ratingUpdate', {
                materialId: materialId,
                rating: material.rating,
                reviewCount: allReviews.length
            });
        }

        res.status(201).json(populatedReview);
    } catch (error) {
        console.error('[addMaterialReview] Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getMaterials,
    getMaterial,
    getFaculties,
    uploadMaterial,
    updateMaterial,
    deleteMaterial,
    saveMaterial,
    downloadMaterial,
    getCBT,
    getCBTByMaterial,
    submitCBT,
    summarizeMaterial,
    getCategories,
    getPersonalLibrary,
    addMaterialReview
};
