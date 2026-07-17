with normalized_dates as (
    select
        id,
        translate(
            replace(replace(trim(orthodontic_start_date), '-', '/'), '.', '/'),
            '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩',
            '01234567890123456789'
        ) as normalized_value
    from public.patients
    where orthodontic_start_date is not null
)
update public.patients as patients
set orthodontic_start_date =
    split_part(normalized_dates.normalized_value, '/', 1)
    || '/'
    || lpad(split_part(normalized_dates.normalized_value, '/', 2), 2, '0')
    || '/'
    || lpad(split_part(normalized_dates.normalized_value, '/', 3), 2, '0')
from normalized_dates
where patients.id = normalized_dates.id
  and normalized_dates.normalized_value ~ '^[0-9]{3,4}/[0-9]{1,2}/[0-9]{1,2}$';

comment on column public.patients.orthodontic_start_date is
    'Orthodontic treatment start date as a canonical ASCII Jalali value in YYYY/MM/DD format.';
