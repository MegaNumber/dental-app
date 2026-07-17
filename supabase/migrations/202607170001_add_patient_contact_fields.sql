alter table public.patients
    add column if not exists mobile text,
    add column if not exists orthodontic_start_date text;

create index if not exists patients_mobile_idx
    on public.patients (mobile);

comment on column public.patients.mobile is
    'Normalized patient mobile number, stored with English digits.';

comment on column public.patients.orthodontic_start_date is
    'Orthodontic treatment start date as a fa-IR/Jalali display value.';
