-- Create messages table for the GranTES system
CREATE TABLE IF NOT EXISTS `messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_id` int(11) NOT NULL,
  `receiver_id` int(11) NOT NULL,
  `sender_type` varchar(50) NOT NULL,
  `receiver_type` varchar(50) NOT NULL,
  `content` text NOT NULL,
  `attachment` mediumtext DEFAULT NULL,
  `attachment_name` varchar(255) DEFAULT NULL,
  `read_status` tinyint(1) DEFAULT 0,
  `created_at` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sender_idx` (`sender_id`, `sender_type`),
  KEY `receiver_idx` (`receiver_id`, `receiver_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

