-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `externalId` VARCHAR(100) NOT NULL,
    `identity` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `role` ENUM('PARTICIPANT', 'ADMIN', 'GRADER') NOT NULL DEFAULT 'PARTICIPANT',
    `groupName` VARCHAR(150) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_externalId_key`(`externalId`),
    INDEX `users_identity_idx`(`identity`),
    INDEX `users_role_isActive_idx`(`role`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `successCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `message` TEXT NULL,
    `triggeredById` INTEGER NULL,

    INDEX `sync_logs_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sync_failures` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `syncLogId` INTEGER NOT NULL,
    `externalId` VARCHAR(100) NULL,
    `identity` VARCHAR(100) NULL,
    `reason` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sync_failures_syncLogId_idx`(`syncLogId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,

    UNIQUE INDEX `question_categories_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `type` ENUM('MULTIPLE_CHOICE', 'ESSAY') NOT NULL,
    `body` TEXT NOT NULL,
    `imagePath` VARCHAR(255) NULL,
    `defaultWeight` DECIMAL(6, 2) NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `questions_code_key`(`code`),
    INDEX `questions_categoryId_type_idx`(`categoryId`, `type`),
    INDEX `questions_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `answer_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `questionId` INTEGER NOT NULL,
    `label` VARCHAR(5) NOT NULL,
    `body` TEXT NOT NULL,
    `imagePath` VARCHAR(255) NULL,
    `isCorrect` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `answer_options_questionId_idx`(`questionId`),
    UNIQUE INDEX `answer_options_questionId_label_key`(`questionId`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `essay_keys` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `questionId` INTEGER NOT NULL,
    `answerKey` TEXT NOT NULL,
    `rubric` TEXT NULL,

    UNIQUE INDEX `essay_keys_questionId_key`(`questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `examDate` DATE NOT NULL,
    `durationMinutes` INTEGER NOT NULL,
    `shuffleQuestions` BOOLEAN NOT NULL DEFAULT false,
    `shuffleOptions` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `exams_examDate_idx`(`examDate`),
    INDEX `exams_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `examId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `weight` DECIMAL(6, 2) NOT NULL,

    INDEX `exam_questions_questionId_idx`(`questionId`),
    UNIQUE INDEX `exam_questions_examId_questionId_key`(`examId`, `questionId`),
    UNIQUE INDEX `exam_questions_examId_sortOrder_key`(`examId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_sessions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `examId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `attendanceOpensAt` DATETIME(3) NOT NULL,
    `capacity` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `exam_sessions_examId_idx`(`examId`),
    INDEX `exam_sessions_startsAt_idx`(`startsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_participants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `examDate` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `session_participants_sessionId_idx`(`sessionId`),
    UNIQUE INDEX `session_participants_sessionId_userId_key`(`sessionId`, `userId`),
    UNIQUE INDEX `session_participants_userId_examDate_key`(`userId`, `examDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `checkedInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(255) NULL,

    INDEX `attendances_sessionId_idx`(`sessionId`),
    UNIQUE INDEX `attendances_sessionId_userId_key`(`sessionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `exam_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `deadlineAt` DATETIME(3) NOT NULL,
    `extraSeconds` INTEGER NOT NULL DEFAULT 0,
    `submittedAt` DATETIME(3) NULL,
    `status` ENUM('IN_PROGRESS', 'SUBMITTED', 'TIME_EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS',
    `questionOrder` JSON NOT NULL,
    `optionOrder` JSON NULL,
    `lastQuestionIndex` INTEGER NOT NULL DEFAULT 0,
    `mcScore` DECIMAL(8, 2) NULL,
    `essayScore` DECIMAL(8, 2) NULL,
    `totalScore` DECIMAL(8, 2) NULL,
    `gradingStatus` ENUM('NOT_GRADED', 'PARTIAL', 'COMPLETED') NOT NULL DEFAULT 'NOT_GRADED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `exam_attempts_sessionId_status_idx`(`sessionId`, `status`),
    INDEX `exam_attempts_sessionId_gradingStatus_idx`(`sessionId`, `gradingStatus`),
    UNIQUE INDEX `exam_attempts_sessionId_userId_key`(`sessionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attempt_answers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attemptId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `selectedOptionId` INTEGER NULL,
    `essayText` MEDIUMTEXT NULL,
    `isDoubtful` BOOLEAN NOT NULL DEFAULT false,
    `answeredAt` DATETIME(3) NULL,
    `isCorrect` BOOLEAN NULL,
    `score` DECIMAL(6, 2) NULL,
    `gradingState` ENUM('NOT_REQUIRED', 'PENDING', 'LOCKED', 'GRADED') NOT NULL DEFAULT 'NOT_REQUIRED',
    `lockedById` INTEGER NULL,
    `lockedAt` DATETIME(3) NULL,
    `gradedById` INTEGER NULL,
    `gradedAt` DATETIME(3) NULL,
    `gradingNote` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attempt_answers_gradingState_lockedAt_idx`(`gradingState`, `lockedAt`),
    INDEX `attempt_answers_questionId_idx`(`questionId`),
    INDEX `attempt_answers_gradedById_idx`(`gradedById`),
    UNIQUE INDEX `attempt_answers_attemptId_questionId_key`(`attemptId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `violation_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attemptId` INTEGER NOT NULL,
    `type` ENUM('FULLSCREEN_EXIT', 'TAB_SWITCH', 'WINDOW_BLUR', 'COPY_PASTE', 'RIGHT_CLICK') NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `questionNumber` INTEGER NULL,
    `detail` VARCHAR(255) NULL,

    INDEX `violation_logs_attemptId_occurredAt_idx`(`attemptId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `action` VARCHAR(60) NOT NULL,
    `entityType` VARCHAR(60) NOT NULL,
    `entityId` VARCHAR(60) NULL,
    `meta` JSON NULL,
    `ipAddress` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `audit_logs_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sync_logs` ADD CONSTRAINT `sync_logs_triggeredById_fkey` FOREIGN KEY (`triggeredById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sync_failures` ADD CONSTRAINT `sync_failures_syncLogId_fkey` FOREIGN KEY (`syncLogId`) REFERENCES `sync_logs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `question_categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `answer_options` ADD CONSTRAINT `answer_options_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `essay_keys` ADD CONSTRAINT `essay_keys_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exams` ADD CONSTRAINT `exams_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_questions` ADD CONSTRAINT `exam_questions_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_questions` ADD CONSTRAINT `exam_questions_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_sessions` ADD CONSTRAINT `exam_sessions_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `exam_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_participants` ADD CONSTRAINT `session_participants_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `exam_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `exam_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `exam_attempts` ADD CONSTRAINT `exam_attempts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempt_answers` ADD CONSTRAINT `attempt_answers_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempt_answers` ADD CONSTRAINT `attempt_answers_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempt_answers` ADD CONSTRAINT `attempt_answers_selectedOptionId_fkey` FOREIGN KEY (`selectedOptionId`) REFERENCES `answer_options`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempt_answers` ADD CONSTRAINT `attempt_answers_lockedById_fkey` FOREIGN KEY (`lockedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attempt_answers` ADD CONSTRAINT `attempt_answers_gradedById_fkey` FOREIGN KEY (`gradedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `violation_logs` ADD CONSTRAINT `violation_logs_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `exam_attempts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
