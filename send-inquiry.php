<?php
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: ./investment/');
    exit;
}

$redirectUrl = './thank-you/';
$to = 'thyzfoto@gmail.com';
$subject = 'New wedding inquiry - Thyzfoto';

function form_value(string $key): string
{
    $value = $_POST[$key] ?? '';

    if (is_array($value)) {
        $value = implode(', ', $value);
    }

    $value = strip_tags((string) $value);
    $value = str_replace(["\r\n", "\r"], "\n", $value);

    return trim($value);
}

function header_value(string $value): string
{
    return str_replace(["\r", "\n"], '', $value);
}

$honeypot = form_value('_gotcha');

if ($honeypot !== '') {
    header('Location: ' . $redirectUrl, true, 303);
    exit;
}

$fullName = form_value('fullName');
$email = form_value('email');
$validEmail = filter_var($email, FILTER_VALIDATE_EMAIL);

$fields = [
    'Full name' => $fullName,
    'Email' => $email,
    'Phone' => form_value('phone'),
    'Instagram' => form_value('instagram'),
    'Wedding date' => form_value('weddingDate'),
    'Wedding location' => form_value('weddingLocation'),
    'Looking for' => form_value('coverage'),
    'Day type' => form_value('eventType'),
    'Ideal budget' => form_value('budget'),
    'What speaks to them' => form_value('speaks'),
    'Heard about you from' => form_value('heardAbout'),
    'Details' => form_value('details'),
];

$messageLines = [
    'New wedding inquiry from the website.',
    '',
];

foreach ($fields as $label => $value) {
    $messageLines[] = $label . ': ' . ($value !== '' ? $value : '-');
}

$message = implode("\n", $messageLines);
$host = $_SERVER['HTTP_HOST'] ?? 'thyzfoto.com';
$fromEmail = 'no-reply@' . preg_replace('/^www\./i', '', $host);
$replyTo = $validEmail ? header_value($email) : $fromEmail;

$headers = [
    'From: Website Inquiry <' . $fromEmail . '>',
    'Reply-To: ' . $replyTo,
    'Content-Type: text/plain; charset=UTF-8',
];

mail($to, $subject, $message, implode("\r\n", $headers));

header('Location: ' . $redirectUrl, true, 303);
exit;