-- AlterTable
ALTER TABLE `users` ADD COLUMN `nisn` VARCHAR(30) NULL,
    MODIFY `externalId` VARCHAR(100) NULL;

-- CreateTable
CREATE TABLE `api_clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `description` VARCHAR(500) NULL,
    `status` ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    `allExams` BOOLEAN NOT NULL DEFAULT false,
    `allowedIps` JSON NULL,
    `rateLimitPerMinute` INTEGER NOT NULL DEFAULT 60,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,

    INDEX `api_clients_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_client_exams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
    `examId` INTEGER NOT NULL,

    INDEX `api_client_exams_examId_idx`(`examId`),
    UNIQUE INDEX `api_client_exams_clientId_examId_key`(`clientId`, `examId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_keys` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
    `prefix` VARCHAR(32) NOT NULL,
    `keyHash` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `lastUsedAt` DATETIME(3) NULL,

    UNIQUE INDEX `api_keys_prefix_key`(`prefix`),
    INDEX `api_keys_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_access_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
    `keyId` INTEGER NULL,
    `method` VARCHAR(10) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `query` VARCHAR(500) NULL,
    `statusCode` INTEGER NOT NULL,
    `durationMs` INTEGER NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `api_access_logs_clientId_createdAt_idx`(`clientId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `exam_attempts_updatedAt_id_idx` ON `exam_attempts`(`updatedAt`, `id`);

-- CreateIndex
CREATE UNIQUE INDEX `users_nisn_key` ON `users`(`nisn`);

-- AddForeignKey
ALTER TABLE `api_clients` ADD CONSTRAINT `api_clients_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_client_exams` ADD CONSTRAINT `api_client_exams_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `api_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_client_exams` ADD CONSTRAINT `api_client_exams_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `api_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_access_logs` ADD CONSTRAINT `api_access_logs_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `api_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_access_logs` ADD CONSTRAINT `api_access_logs_keyId_fkey` FOREIGN KEY (`keyId`) REFERENCES `api_keys`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
