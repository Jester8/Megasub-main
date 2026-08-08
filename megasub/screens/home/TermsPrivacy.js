import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const FONTS = {
  regular: 'Manrope_400Regular',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

const BRAND = '#4A55DD';

// Full text supplied by Samuel (Megasub_Terms_and_Conditions.pdf /
// Megasub Privacy Policy_.pdf) — replaces the earlier 6-item placeholder.
const TERMS_SECTIONS = [
  {
    title: '1. Introduction',
    body: 'Welcome to Mega-Sub Solutions ("Mega-Sub", "we", "our", or "us"). These Terms and Conditions ("Terms") govern your access to and use of our website, mobile application, APIs, digital platforms, and all services provided by Mega-Sub Solutions.\n\nMega-Sub Solutions is a Nigerian digital services platform that enables users to purchase airtime, mobile data, electricity tokens, cable television subscriptions, examination pins, and other digital products and payment services that may be introduced from time to time.\n\nThese Terms constitute a legally binding agreement between you ("User", "Customer", "you", or "your") and Mega-Sub Solutions. By creating an account, accessing our platform, or using any of our services, you confirm that you have read, understood, and agree to be bound by these Terms.\n\nIf you do not agree with any provision contained herein, you must immediately discontinue the use of our platform and services.\n\nThese Terms should be read together with our Privacy Policy, Refund Policy, and any other policies published on our website or mobile application.',
  },
  {
    title: '2. Definitions',
    body: 'Account means a registered user profile created to access Mega-Sub services.\nAPI means any application programming interface made available by Mega-Sub for developers, resellers, merchants, or business partners.\nBusiness Day means any day excluding Saturdays, Sundays, and officially recognized public holidays in the Federal Republic of Nigeria.\nCustomer, User, or You means any individual or legal entity accessing or using the Services.\nDigital Products include airtime, mobile data, cable television subscriptions, electricity tokens, educational PINs, gift cards, and any other products offered through the Platform.\nPlatform means the Mega-Sub website, mobile applications, APIs, dashboards, software, and related systems operated by Mega-Sub Solutions.\nServices means all products and services provided through the Platform.\nTransaction means any successful or attempted purchase, payment, transfer, subscription, wallet funding, withdrawal, or other financial activity conducted through the Platform.\nWallet means the electronic balance maintained on behalf of a registered customer for the purpose of making payments on the Platform, where applicable.\nThird-Party Provider means telecommunications operators, electricity distribution companies, cable television providers, banks, payment processors, payment gateways, merchants, aggregators, or any external organization whose services are utilized by Mega-Sub.',
  },
  {
    title: '3. Acceptance of these Terms',
    body: 'By accessing or using the Platform, you represent and warrant that you are at least 18 years old or otherwise possess the legal capacity to enter into binding agreements under applicable Nigerian law; all information provided during registration is true, complete, and accurate; you agree to comply with these Terms and all applicable laws and regulations; and you will use the Platform solely for lawful purposes.\n\nYour continued use of the Platform constitutes your acceptance of any future amendments to these Terms.\n\nWhere you access the Platform on behalf of a business, company, organization, or other legal entity, you confirm that you have the authority to bind that entity to these Terms.',
  },
  {
    title: '4. Eligibility',
    body: 'To use our Services, you must possess a valid mobile telephone number and email address where applicable; provide accurate registration information; not have been previously suspended or permanently removed from the Platform; not use the Platform for illegal or fraudulent purposes; and comply with all Know Your Customer (KYC) and identity verification requirements where applicable.\n\nWe reserve the right to refuse registration or access to any individual or organization where required by law, regulation, internal risk assessment, or fraud prevention measures.',
  },
  {
    title: '5. User Accounts',
    body: 'To access certain Services, you may be required to create an account. When creating an account, you agree to provide accurate and complete registration details; keep your information updated at all times; maintain the confidentiality of your password, PIN, one-time passwords (OTPs), and other authentication credentials; notify Mega-Sub immediately if you suspect unauthorized access to your account; and accept full responsibility for all activities conducted through your account unless otherwise required by law.\n\nUsers are responsible for ensuring the security of their devices, login credentials, and internet connections.\n\nMega-Sub shall not be liable for losses resulting from the disclosure of passwords, PINs, OTPs, or other authentication credentials by the user to third parties.\n\nWe reserve the right to suspend, restrict, or permanently terminate accounts that violate these Terms or present security, compliance, or fraud risks.',
  },
  {
    title: '6. Identity Verification (Know Your Customer)',
    body: 'To comply with applicable laws, regulations, anti-money laundering requirements, counter-terrorism financing obligations, and fraud prevention measures, Mega-Sub may require users to complete identity verification before accessing certain Services.\n\nVerification may include, but is not limited to: full legal name; date of birth; residential address; government-issued identification; Bank Verification Number (BVN), National Identification Number (NIN), or other legally recognized identification; selfie or biometric verification where permitted by law; proof of address; and additional documentation reasonably requested by Mega-Sub.\n\nWe reserve the right to refuse, suspend, restrict, or terminate any account where verification cannot be completed; false or misleading information has been provided; suspicious or fraudulent activity is detected; or legal or regulatory requirements so require.\n\nUsers agree that Mega-Sub may periodically request updated verification information to maintain compliance with applicable laws and regulatory requirements.',
  },
  {
    title: '7. Services Provided',
    body: 'Mega-Sub Solutions provides a digital platform through which registered and eligible users may purchase or access various electronic products and payment services. The Services available on the Platform may change from time to time as new products are introduced or existing services are modified or discontinued.\n\nServices currently offered may include, but are not limited to: mobile airtime purchases; mobile data subscriptions; electricity bill payments and prepaid token generation; cable television subscriptions; educational examination PINs and vouchers; gift cards and digital vouchers; utility bill payments; wallet funding and wallet-based payments, where available; merchant payment services; business APIs and reseller services; and other digital financial or payment services introduced by Mega-Sub.\n\nMega-Sub reserves the right to add, modify, suspend, or discontinue any Service without prior notice where necessary for operational, legal, regulatory, commercial, or security reasons.\n\nThe availability of any Service may vary depending on the relevant service provider, geographic location, regulatory requirements, maintenance schedules, or technical limitations. Mega-Sub does not guarantee that every Service will always be available or uninterrupted.',
  },
  {
    title: '8. Wallet Services',
    body: 'Where Mega-Sub offers electronic wallet functionality, users may maintain funds within their wallet solely for the purpose of purchasing services available on the Platform.\n\nWallet balances are not bank deposits and do not constitute savings, investments, or interest-bearing accounts unless expressly stated otherwise.\n\nUsers may fund their wallet using payment methods approved by Mega-Sub, including debit or credit cards; bank transfers; approved payment gateways; merchant settlement; and other funding methods introduced by Mega-Sub.\n\nWallet balances may only be used for lawful transactions carried out through the Platform.\n\nMega-Sub reserves the right to place temporary restrictions on wallet transactions where fraud prevention measures, regulatory requirements, chargeback investigations, or security concerns make such restrictions necessary.\n\nUsers are responsible for confirming all payment details before funding their wallet.\n\nWhere wallet withdrawal services are available, such withdrawals shall be subject to applicable verification requirements; transaction limits; processing timelines; applicable fees; and regulatory requirements.\n\nMega-Sub reserves the right to refuse wallet funding or withdrawals where fraud, money laundering, sanctions screening, identity concerns, or other compliance issues are reasonably suspected.',
  },
  {
    title: '9. Payments and Billing',
    body: 'Users agree to pay all charges applicable to transactions initiated through the Platform.\n\nThe total amount payable shall include the cost of the selected product together with any applicable service charges, convenience fees, transaction charges, taxes, or statutory levies where applicable.\n\nPayments may be made through approved payment channels including wallet balance; bank transfer; debit or credit card; instant payment platforms; USSD; licensed payment service providers; or other payment methods approved by Mega-Sub.\n\nTransactions shall only be processed after successful confirmation of payment. Users acknowledge that payment confirmation may occasionally be delayed due to factors outside Mega-Sub\'s control, including banking network delays, payment gateway interruptions, telecommunications failures, or third-party provider issues.\n\nMega-Sub reserves the right to reject any transaction where payment cannot be successfully verified. Users remain responsible for ensuring sufficient funds are available before initiating any transaction.',
  },
  {
    title: '10. Pricing',
    body: 'Prices displayed on the Platform are subject to change without prior notice.\n\nProduct pricing may vary due to telecommunications operator pricing; electricity distribution company pricing; cable television provider pricing; taxation; exchange rate fluctuations; regulatory changes; supplier pricing adjustments; promotional campaigns; or operational costs.\n\nThe applicable price shall be the price displayed and confirmed at the point of transaction.\n\nMega-Sub shall not be liable for pricing errors resulting from technical faults, incorrect supplier pricing, system malfunction, or typographical mistakes. Where an obvious pricing error has occurred, Mega-Sub reserves the right to cancel the affected transaction and refund any payment received where appropriate.',
  },
  {
    title: '11. Transaction Processing',
    body: 'Users are responsible for verifying all transaction details before confirming payment, including recipient mobile numbers; network provider; electricity meter numbers; cable television smart card numbers; examination PIN selection; payment amount; product selection; wallet details; and any other information relevant to the transaction.\n\nOnce a transaction has been submitted for processing, it may not be reversible if the service provider has already fulfilled the request.\n\nTransaction confirmation may be delivered through SMS; email; mobile application notification; dashboard history; or other communication channels used by Mega-Sub.\n\nMega-Sub reserves the right to delay or reject transactions where additional verification is required for security, fraud prevention, compliance, or operational reasons. Processing times may vary depending on third-party providers and payment networks.',
  },
  {
    title: '12. Failed, Pending, and Reversed Transactions',
    body: 'While Mega-Sub strives to process transactions promptly, certain transactions may fail, remain pending, or require reversal due to circumstances beyond our reasonable control, such as banking network failures; payment gateway downtime; telecommunications operator delays; electricity provider interruptions; cable provider system failures; API failures; internet connectivity issues; force majeure events; or fraud prevention investigations.\n\nWhere a transaction remains pending, Mega-Sub may investigate the matter with the relevant third-party provider before determining the appropriate resolution.\n\nIf payment has been successfully received but the requested service was not delivered, Mega-Sub shall use reasonable efforts to complete the transaction; reverse the transaction; credit the user\'s wallet; or refund the user where appropriate. Refund timelines may vary depending on banks, payment processors, regulators, and third-party providers.\n\nMega-Sub shall not be liable for delays caused solely by third-party providers or financial institutions.\n\nUsers must report disputed transactions within seven (7) days of the transaction date unless a longer period is required by applicable law. Failure to report within this period may affect Mega-Sub\'s ability to investigate and recover funds. Users must cooperate fully during any investigation by providing transaction references, payment receipts, screenshots, or any other information reasonably requested.',
  },
  {
    title: '13. Transaction Limits',
    body: 'Mega-Sub may impose daily, weekly, monthly, or annual transaction limits in accordance with applicable laws, regulatory requirements, internal risk management policies, and the user\'s verification status.\n\nTransaction limits may differ based on factors including account verification level; customer category; product type; payment method; fraud risk assessment; and regulatory directives.\n\nMega-Sub reserves the right to adjust these limits at any time without prior notice where required by law, security considerations, or operational needs. Transactions exceeding applicable limits may be declined, delayed pending further verification, or require additional documentation before processing.',
  },
  {
    title: '14. Refund Policy',
    body: 'Mega-Sub is committed to providing reliable digital payment services. Due to the nature of digital products and the immediate processing of transactions, refunds are only granted under the circumstances outlined in these Terms.\n\nRefunds may be considered where payment was successfully received but the requested service was not delivered; duplicate payments were made for the same transaction due to a verified system error; Mega-Sub incorrectly processed a transaction due to an internal technical fault; a transaction was cancelled before it was successfully completed; or a refund is required under applicable law or regulatory direction.\n\nRefunds shall generally not be granted where the customer entered an incorrect phone number, smart card number, meter number, account number, or other recipient information; the customer selected the wrong product, network, bouquet, or service provider; the transaction was successfully delivered to the details provided by the customer; the customer changes their mind after successful delivery of a digital product; or delays or failures arise solely from third-party providers after successful fulfilment.\n\nApproved refunds may be processed by reversal to the original payment method; credit to the customer\'s Mega-Sub wallet; bank transfer; or any other method determined by Mega-Sub. Refund processing times may vary depending on payment providers, banks, regulators, and third-party service providers.\n\nNothing in this clause limits any statutory consumer rights available under applicable Nigerian law.',
  },
  {
    title: '15. Promotions, Discounts and Bonuses',
    body: 'Mega-Sub may, from time to time, offer promotional campaigns, loyalty programs, referral rewards, cashback offers, discount vouchers, or bonus credits.\n\nUnless otherwise stated, all promotions are offered for a limited period; may be withdrawn or modified without prior notice; cannot be exchanged for cash unless expressly permitted; are non-transferable; and may only be used in accordance with the applicable promotion rules.\n\nMega-Sub reserves the right to cancel, suspend, or reclaim any promotional benefit obtained through fraud; abuse of the promotion; multiple account creation; system manipulation; breach of these Terms; or any activity reasonably considered dishonest. Where promotional credits are revoked, Mega-Sub may deduct the equivalent value from the user\'s wallet or account where permitted by law.',
  },
  {
    title: '16. User Responsibilities',
    body: 'Users agree to use the Platform responsibly and in accordance with these Terms. Each user agrees to provide accurate information at all times; maintain the confidentiality of login credentials; verify transaction details before submission; comply with applicable laws and regulations; cooperate during fraud investigations; promptly report unauthorized account activity; maintain the security of devices used to access the Platform; ensure sufficient funds are available before initiating transactions; and use the Platform only for lawful purposes.\n\nUsers are solely responsible for all activities carried out using their accounts unless otherwise required by applicable law. Failure to comply with these obligations may result in suspension or termination of the account.',
  },
  {
    title: '17. Prohibited Activities',
    body: 'Users shall not use the Platform to engage in any unlawful, fraudulent, abusive, or harmful activity. Prohibited activities include, but are not limited to, providing false identity information; impersonating another individual or organization; using stolen payment cards or bank accounts; attempting unauthorized access to Mega-Sub systems; introducing viruses, malware, ransomware, spyware, or malicious code; interfering with Platform operations; attempting to reverse engineer the Platform; exploiting software vulnerabilities; creating multiple accounts to abuse promotions; money laundering; terrorist financing; financing illegal activities; transmitting unlawful or offensive material; infringing intellectual property rights; using automated bots or scripts without written authorization; reselling Mega-Sub services without approval where approval is required; and engaging in any conduct that may damage Mega-Sub\'s reputation or operations.\n\nMega-Sub reserves the right to investigate any suspected violation and to cooperate with law enforcement agencies or regulatory authorities where necessary.',
  },
  {
    title: '18. Intellectual Property',
    body: 'All intellectual property rights relating to the Platform remain the exclusive property of Mega-Sub Solutions or its licensors. This includes, but is not limited to, trademarks; logos; business names; software; website design; mobile applications; graphics; databases; APIs; documentation; source code; text; images; videos; and other proprietary materials.\n\nUsers are granted a limited, non-exclusive, non-transferable, and revocable license to access and use the Platform solely for its intended purpose. Users shall not copy; reproduce; distribute; modify; publish; sell; sublicense; reverse engineer; create derivative works from; or commercially exploit any part of the Platform without Mega-Sub\'s prior written consent.\n\nNothing contained in these Terms transfers ownership of any intellectual property rights to users.',
  },
  {
    title: '19. Third-Party Providers',
    body: 'Many services available through the Platform are supplied by independent third-party providers including mobile network operators; electricity distribution companies; cable television providers; payment gateways; financial institutions; merchants; technology vendors; and government agencies.\n\nMega-Sub acts as a technology platform facilitating access to these services. Service delivery, availability, pricing, maintenance schedules, and technical operations of third-party providers remain under their control.\n\nMega-Sub shall not be liable for losses arising solely from third-party outages; network failures; supplier maintenance; provider pricing changes; government directives affecting third-party services; or interruptions beyond Mega-Sub\'s reasonable control. Where practical, Mega-Sub will work with relevant providers to resolve customer issues as quickly as possible.',
  },
  {
    title: '20. Fraud Prevention and Security',
    body: 'Mega-Sub maintains comprehensive security measures designed to protect users and the Platform from fraud, unauthorized access, and financial crime. To safeguard the Platform, Mega-Sub may monitor transactions in real time; conduct risk assessments; verify customer identities; request additional documentation; temporarily suspend transactions; place accounts under review; report suspicious activities to competent authorities; decline transactions considered high risk; and freeze accounts where legally required.\n\nUsers must immediately notify Mega-Sub if they suspect unauthorized account access; compromised passwords or PINs; fraudulent transactions; phishing attempts; identity theft; or any other security incident. Failure to promptly report suspected fraud may affect Mega-Sub\'s ability to prevent further losses or recover funds.\n\nMega-Sub reserves the right to cooperate fully with law enforcement agencies, financial institutions, regulators, and other competent authorities in relation to suspected criminal activity.',
  },
  {
    title: '21. Suspension and Termination',
    body: 'Mega-Sub reserves the right to suspend, restrict, or permanently terminate any account or access to the Platform where it reasonably believes that such action is necessary to protect its users, comply with legal or regulatory obligations, or safeguard the integrity of its Services.\n\nAn account may be suspended or terminated where these Terms have been breached; false, misleading, or fraudulent information has been provided; fraudulent or suspicious transactions are detected; there is suspected money laundering, terrorist financing, or other financial crime; applicable laws or regulatory directives require such action; the account has remained inactive for an extended period, subject to applicable law; the Platform has been used for unlawful purposes; or continued access presents a security, operational, or reputational risk.\n\nWhere practicable, Mega-Sub may notify the affected user before or after suspension. However, immediate suspension may occur without prior notice where required for security, legal, or regulatory reasons.\n\nTermination of an account does not affect any rights, obligations, liabilities, or outstanding payments that accrued before termination.',
  },
  {
    title: '22. Service Availability',
    body: 'Mega-Sub aims to provide reliable and continuous access to its Platform. However, uninterrupted availability cannot be guaranteed. Services may occasionally be unavailable due to scheduled maintenance; emergency maintenance; telecommunications failures; banking network interruptions; payment gateway outages; internet service disruptions; cyberattacks; software updates; hardware failures; acts of government; or circumstances beyond Mega-Sub\'s reasonable control.\n\nMega-Sub may temporarily suspend access to all or part of the Platform for maintenance, upgrades, security improvements, or compliance requirements. While reasonable efforts will be made to minimize disruptions, Mega-Sub shall not be liable for losses resulting solely from temporary service interruptions.',
  },
  {
    title: '23. Disclaimers',
    body: 'The Platform and all Services are provided on an "as is" and "as available" basis.\n\nTo the fullest extent permitted by applicable law, Mega-Sub makes no representation or warranty, express or implied, regarding uninterrupted availability of the Platform; error-free operation; compatibility with every device or browser; continuous access to third-party services; merchantability; fitness for a particular purpose; or freedom from viruses or other harmful components.\n\nUsers acknowledge that digital payment services depend upon third-party networks and infrastructure outside Mega-Sub\'s direct control. Nothing in these Terms excludes any warranty or protection that cannot legally be excluded under applicable law.',
  },
  {
    title: '24. Limitation of Liability',
    body: 'To the maximum extent permitted by law, Mega-Sub shall not be liable for any indirect, incidental, consequential, punitive, exemplary, or special damages arising from or relating to the use of the Platform. This includes, but is not limited to, loss of profits; loss of business opportunities; loss of goodwill; loss of anticipated savings; loss of revenue; business interruption; data loss; unauthorized access resulting from user negligence; or third-party system failures.\n\nWhere Mega-Sub is found liable for any claim, its total liability shall, to the extent permitted by law, not exceed the amount paid by the user in relation to the specific transaction giving rise to the claim.\n\nNothing in these Terms limits liability for fraud, willful misconduct, gross negligence, death, personal injury, or any liability that cannot legally be excluded under Nigerian law.',
  },
  {
    title: '25. Indemnification',
    body: 'Users agree to indemnify, defend, and hold harmless Mega-Sub Solutions, its directors, officers, employees, agents, affiliates, licensors, contractors, and service providers from and against any claims, liabilities, damages, losses, costs, expenses, penalties, or legal fees arising from breach of these Terms; misuse of the Platform; fraudulent activities; violation of applicable laws; infringement of third-party rights; unauthorized use of another person\'s payment instrument or account; negligent or intentional misconduct; or any dispute arising from information provided by the user.\n\nThis obligation survives the termination of these Terms.',
  },
  {
    title: '26. Privacy and Data Protection',
    body: 'Mega-Sub processes personal information in accordance with its Privacy Policy and applicable Nigerian data protection laws. By using the Platform, users consent to the collection, storage, processing, and sharing of personal information where necessary for providing Services; identity verification; fraud prevention; customer support; regulatory compliance; legal obligations; and improving the Platform.\n\nUsers are encouraged to review the Mega-Sub Privacy Policy, which forms an integral part of these Terms.',
  },
  {
    title: '27. Force Majeure',
    body: 'Mega-Sub shall not be liable for any delay or failure in performing its obligations where such delay or failure results from circumstances beyond its reasonable control. Such events include, but are not limited to, natural disasters; floods; earthquakes; fires; epidemics or pandemics; war; terrorism; civil unrest; strikes; government actions; regulatory restrictions; telecommunications failures; internet outages; banking network failures; cyberattacks; or power failures.\n\nWhere a force majeure event continues for an extended period, Mega-Sub may suspend or discontinue affected Services without incurring liability.',
  },
  {
    title: '28. Governing Law',
    body: 'These Terms shall be governed by and interpreted in accordance with the laws of the Federal Republic of Nigeria, without regard to conflict of law principles. Users agree that all rights and obligations arising under these Terms shall be interpreted in accordance with Nigerian law.',
  },
  {
    title: '29. Dispute Resolution',
    body: 'Mega-Sub is committed to resolving disputes fairly and efficiently. Users are encouraged to first contact Mega-Sub\'s customer support team to allow an opportunity for amicable resolution.\n\nWhere a dispute cannot be resolved through negotiation, the parties may pursue mediation or any other alternative dispute resolution mechanism agreed between them. If the dispute remains unresolved, either party may commence legal proceedings before a court of competent jurisdiction in the Federal Republic of Nigeria.\n\nNothing in this clause prevents either party from seeking urgent injunctive or equitable relief where necessary.',
  },
  {
    title: '30. Amendments to these Terms',
    body: 'Mega-Sub may amend these Terms from time to time to reflect changes in applicable law; regulatory requirements; technological developments; business operations; security practices; or the introduction of new Services.\n\nUpdated Terms become effective upon publication on the Platform or on such later date as may be specified. Continued use of the Platform after the effective date constitutes acceptance of the revised Terms.',
  },
  {
    title: '31. Electronic Communications',
    body: 'By using the Platform, users consent to receive communications electronically. Such communications may include transaction notifications; OTPs; security alerts; promotional messages (where consent has been provided); legal notices; policy updates; account notifications; and customer support communications.\n\nElectronic communications shall satisfy any legal requirement that communications be made in writing.',
  },
  {
    title: '32. General Provisions',
    body: 'Entire Agreement: These Terms, together with the Privacy Policy, Refund Policy, and any additional policies published by Mega-Sub, constitute the entire agreement between Mega-Sub and the user regarding the use of the Platform.\n\nSeverability: If any provision of these Terms is found by a court of competent jurisdiction to be invalid, illegal, or unenforceable, the remaining provisions shall remain in full force and effect.\n\nWaiver: Failure by Mega-Sub to enforce any provision of these Terms shall not constitute a waiver of that provision or any other rights.\n\nAssignment: Users may not assign or transfer any rights or obligations under these Terms without Mega-Sub\'s prior written consent. Mega-Sub may assign its rights and obligations where permitted by law.\n\nSurvival: Any provisions intended by their nature to survive termination, including those relating to liability, indemnification, dispute resolution, intellectual property, and governing law, shall continue in effect after termination.',
  },
  {
    title: '33. Contact Information',
    body: 'If you have any questions, complaints, requests, or concerns regarding these Terms and Conditions, please contact us using the details below:\n\nMega-Sub Solutions — Customer Support\nEmail: info@mega-sub.com\nPhone: +234 813 474 5216\nBusiness Hours: Monday to Saturday, 8:00 a.m. – 6:00 p.m. (West Africa Time)',
  },
];

const PRIVACY_SECTIONS = [
  {
    title: '1. Introduction',
    body: 'At Mega-sub Solutions, we are deeply committed to protecting the privacy and security of your personal information. As a provider of data, airtime, cable, and electricity subscription services, we understand the importance of securing the information you share with us, and we take extensive measures to safeguard it. This Privacy Policy outlines our practices regarding the collection, use, disclosure, and protection of your information when you interact with our services (the "Service"), access our applications, visit our website, or engage with our customer support team in accordance with the Nigeria Data Protection Regulation (NDPR) and other applicable laws.\n\n"Service" refers to the data, airtime, cable, and electricity subscription services provided by Mega-sub Solutions. "Personal Information" means data that identifies you as an individual, including your name, phone number, email address, and payment information. "Technical Data" includes information about your device, browser, and usage patterns.\n\nBy using our Service, you acknowledge that you have read and understood this Privacy Policy and agree to the collection and use of information as described herein. If you disagree with any part of this policy, please refrain from using our Service.',
  },
  {
    title: '2. Information We Collect',
    body: 'To provide you with seamless subscription services, we may collect the following personal data: contact information (name, email address, and phone number); payment details (bank account numbers, debit card information, or other payment methods used for subscription payments); subscription preferences (details of your chosen services, e.g. data plans, cable packages, electricity providers); and utility account information (e.g. meter numbers, smart card numbers).\n\nIn addition, we may automatically collect device data (IP address, device type, operating system, browser type, and mobile identifiers); usage data (pages visited, features accessed, time spent on the platform, navigation patterns, and service usage frequency); location data (GPS coordinates or IP-based location data, if applicable); and transaction history (records of your subscription purchases and payment activities). We collect this data to improve user experience, optimize our platform, and ensure smooth service delivery.',
  },
  {
    title: '3. How We Use Your Information',
    body: 'We use your information for account management (creating and maintaining your subscription accounts); identity verification (confirming your identity to prevent fraud); transaction processing (facilitating payments for data, airtime, cable, and electricity subscriptions); customer support (assisting with inquiries, complaints, or technical issues); and security enhancement (monitoring for suspicious activity and protecting against fraud).\n\nWe may also use your data for service improvement; marketing and promotions (offering discounts, updates, or recommendations for relevant services); and trend analysis (analysing usage patterns to better meet customer needs).\n\nIn certain cases, we may use automated systems to detect fraud, monitor transactions, or assess risk. These processes are designed to enhance security and ensure fair service delivery.',
  },
  {
    title: '4. Information Sharing and Disclosure',
    body: 'We respect your privacy and do not share your personal information with third parties except in the following situations:\n\nService Providers — we work with trusted third-party vendors to deliver our services, including utility providers (for electricity and cable subscriptions), telecommunication partners (for data and airtime services), and payment processors (to handle secure transactions). These partners have restricted access to your information and are required to protect it in accordance with this Privacy Policy.\n\nLegal Compliance and Protection — we may disclose your information to comply with legal obligations under Nigerian laws, including but not limited to the NDPR, tax reporting requirements, or fraud prevention regulations. This includes sharing information as necessary to protect our rights, users, employees, or property.\n\nBusiness Transfers — in the event of a merger, acquisition, asset sale, or bankruptcy, your information may be transferred as part of that process.\n\nWe do not sell or rent your personal information to third parties.',
  },
  {
    title: '5. Data Security',
    body: 'The security of your data is our top priority. We implement technical measures (end-to-end encryption, firewalls, intrusion detection, and regular security audits) and organizational measures (employee training, access control policies, and incident response plans) to protect your information.\n\nWhile we take stringent precautions, no system is completely immune to risk. Please report any suspicious activity immediately.',
  },
  {
    title: '6. Legal Basis for Processing',
    body: 'We process your information based on contractual necessity (to manage your subscription accounts, deliver our Service, process payments, and manage your account); legal obligations (to comply with laws and regulations related to utility payments and financial transactions); legitimate interests (to improve our services, prevent fraud, and enhance security); and consent-based processing (we rely on your consent for marketing and optional features).',
  },
  {
    title: '7. User Data Rights',
    body: 'Under Nigerian law, including the Nigeria Data Protection Regulation (NDPR), you have certain rights regarding your personal data, which may include:\n\nAccess Rights — request a copy of the personal data we hold about you.\nCorrection Rights — request corrections if any of your personal data is inaccurate or incomplete.\nDeletion Rights — under specific conditions, request the deletion of your personal data from our systems.\nObjection and Restriction Rights — object to certain processing activities, such as direct marketing, or request restrictions on how we process your data.\nData Portability — obtain a copy of your personal data in a structured, commonly used, and machine-readable format.\nConsent Withdrawal — withdraw your consent at any time where processing is based on consent (e.g. marketing communications); this does not affect the lawfulness of processing carried out before the withdrawal.\n\nTo exercise any of these rights, please contact us using the details in Section 15 (Contact Us). We will respond within the timeframe required by Nigerian law, typically within 30 days.',
  },
  {
    title: '8. Data Retention and Deletion',
    body: 'We retain your data only for as long as necessary to fulfil the purposes outlined in this Privacy Policy or to comply with Nigerian legal and regulatory obligations, such as tax reporting or utility payment records.\n\nWhen you close your account or stop using our services, we will securely delete or anonymize your data unless retention is required for legitimate business or legal purposes.\n\nIn certain cases, we may need to maintain your data for longer periods to comply with legal holds, fulfil regulatory requirements, ensure business continuity, or meet audit obligations under Nigerian law.',
  },
  {
    title: '9. International Data Transfers',
    body: 'If you access our Service from outside Nigeria, your information may be transferred to, processed, or stored in Nigeria or other countries where we operate. We ensure compliance with the NDPR by using approved transfer mechanisms, such as Standard Contractual Clauses (SCCs) or obtaining your explicit consent.\n\nTo protect your information during international transfers, we implement additional safeguards, including encryption in transit, data minimization, access controls, audit trails, and regular security assessments in line with Nigerian legal requirements.',
  },
  {
    title: "10. Children's Privacy",
    body: 'Our services, including data and airtime subscriptions, may be used by individuals of all ages, including minors. While we do not knowingly collect sensitive personal information from children without appropriate safeguards, we recognize that some of our users may be under the age of 18.\n\nFor users who are minors, we encourage parents or guardians to oversee their children\'s use of our services. In cases where we collect personal information from minors, we will seek parental consent where required by Nigerian law or the NDPR.\n\nWhen handling data related to minors, we apply additional safeguards, such as data minimization, limited processing, parental controls, and safety measures such as content filters and monitoring mechanisms.\n\nIf you believe we have inadvertently collected data from a minor without proper safeguards, please contact us immediately using the details in Section 15 (Contact Us).',
  },
  {
    title: '11. Cookie and Tracking Technologies',
    body: 'We may use cookies and similar technologies to enhance your experience, including essential cookies (required for basic functionality), analytics cookies (used to collect usage statistics), and marketing cookies (used to deliver personalized promotions).\n\nYou can manage cookie preferences through your browser settings or our cookie consent tool.',
  },
  {
    title: '12. Marketing and Communications',
    body: 'We may send you promotional messages about our services via email, SMS, or push notifications. You can opt out of these communications at any time by updating your preferences or using the unsubscribe link provided.',
  },
  {
    title: '13. Third-Party Integrations',
    body: 'We integrate with third-party partners to enhance our services, such as utility providers, telecommunication companies, and payment processors. We ensure that these partners adhere to strict data protection standards.',
  },
  {
    title: '14. Updates to This Privacy Policy',
    body: 'We may update this Privacy Policy periodically to align with changes in our operational practices, comply with evolving legal requirements (including the NDPR), or address technological advancements. We encourage you to review this policy regularly. When we make significant changes, we will notify you through multiple channels, including email, in-app alerts, or website announcements, in compliance with Nigerian law.',
  },
  {
    title: '15. Contact Us',
    body: 'For questions, comments, or concerns about this Privacy Policy, or to exercise your data protection rights, please contact us at:\n\nMega-sub Solutions — Attn: Customer Satisfaction Officer\nEmail: info@mega-sub.com\nPhone: +234 813 474 5216',
  },
];

// Tab switcher + scrollable section list, with no header of its own — shared
// by the full authenticated screen below and TermsModal.js (used pre-auth on
// signup, where navigating to this screen isn't possible since there's no
// signed-in user yet to send 'back' to).
export function TermsPrivacyBody({ colors, initialTab = 'terms' }) {
  const [tab, setTab] = useState(initialTab);
  const sections = tab === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS;

  return (
    <>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, { backgroundColor: colors.card }, tab === 'terms' && styles.tabBtnActive]}
          onPress={() => setTab('terms')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'terms' && styles.tabTextActive]}>Terms & Conditions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, { backgroundColor: colors.card }, tab === 'privacy' && styles.tabBtnActive]}
          onPress={() => setTab('privacy')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, tab === 'privacy' && styles.tabTextActive]}>Privacy Policy</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {sections.map((s) => (
          <View key={s.title} style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{s.title}</Text>
            <Text style={[styles.sectionBody, { color: colors.textMuted }]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

export default function TermsPrivacy({ navigate }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => navigate && navigate('profile')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Terms & Privacy Policy</Text>
        <View style={{ width: 38 }} />
      </View>

      <TermsPrivacyBody colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0B0D1A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#0B0D1A' },
  tabRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 14 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: BRAND },
  tabText: { fontFamily: FONTS.semibold, fontSize: 13, color: '#6B7088' },
  tabTextActive: { color: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },

  section: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#0B0D1A', marginBottom: 8 },
  sectionBody: { fontFamily: FONTS.regular, fontSize: 12.5, color: 'rgba(11,13,26,0.6)', lineHeight: 19 },
});
